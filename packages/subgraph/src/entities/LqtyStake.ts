import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { LqtyStakeChange, LqtyStake } from "../../generated/schema";

import { decimalize, DECIMAL_ZERO, BIGINT_ZERO } from "../utils/bignumbers";

import { beginChange, initChange, finishChange } from "./Change";
import { getUser } from "./User";
import { handleLQTYStakeChange } from "./Global";

function startLQTYStakeChange(event: ethereum.Event): LqtyStakeChange {
  let sequenceNumber = beginChange(event);
  let stakeChange = new LqtyStakeChange(sequenceNumber.toString());
  initChange(stakeChange, event, sequenceNumber);
  return stakeChange;
}

function finishLQTYStakeChange(stakeChange: LqtyStakeChange): void {
  finishChange(stakeChange);
  stakeChange.save();
}

function getUserStake(address: Address): LqtyStake | null {
  let user = getUser(address);

  if (user.stake == null) {
    return null;
  }

  return LqtyStake.load(user.stake);
}

function createStake(address: Address): LqtyStake {
  let user = getUser(address);
  let stake = new LqtyStake(address.toHexString());

  stake.owner = user.id;
  stake.amount = DECIMAL_ZERO;

  user.stake = stake.id;
  user.save();

  return stake;
}

function getOperationType(
  existingStake: LqtyStake | null,
  stake: LqtyStake | null,
  nextStakeAmount: BigDecimal
): string {
  let isCreating = existingStake == null;
  if (isCreating) {
    return "stakeCreated";
  }

  let isIncreasing = nextStakeAmount > stake.amount;
  if (isIncreasing) {
    return "stakeIncreased";
  }

  let isRemoving = nextStakeAmount == DECIMAL_ZERO;
  if (isRemoving) {
    return "stakeRemoved";
  }

  return "stakeDecreased";
}

export function updateStake(event: ethereum.Event, address: Address, newStake: BigInt): void {
  let existingStake = getUserStake(address);
  let stake = existingStake;

  if (existingStake == null) {
    stake = createStake(address);
  }

  let nextStakeAmount = decimalize(newStake);

  let stakeChange = startLQTYStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.operation = getOperationType(existingStake, stake, nextStakeAmount);
  stakeChange.amountBefore = stake.amount;
  stakeChange.amountChange = nextStakeAmount.minus(stake.amount);
  stakeChange.amountAfter = nextStakeAmount;

  stake.amount = nextStakeAmount;

  handleLQTYStakeChange(stakeChange);

  finishLQTYStakeChange(stakeChange);

  stake.save();
}

export function withdrawStakeGains(
  event: ethereum.Event,
  address: Address,
  LUSDGain: BigInt,
  ETHGain: BigInt
): void {
  if (LUSDGain == BIGINT_ZERO && ETHGain == BIGINT_ZERO) {
    return;
  }

  let stake = getUserStake(address) || createStake(address);
  let stakeChange: LqtyStakeChange = startLQTYStakeChange(event);
  stakeChange.stake = stake.id;
  stakeChange.operation = "gainsWithdrawn";
  stakeChange.issuanceGain = decimalize(LUSDGain);
  stakeChange.redemptionGain = decimalize(ETHGain);
  stakeChange.amountBefore = stake.amount;
  stakeChange.amountChange = DECIMAL_ZERO;
  stakeChange.amountAfter = stake.amount;

  finishLQTYStakeChange(stakeChange);

  stake.save();
}
