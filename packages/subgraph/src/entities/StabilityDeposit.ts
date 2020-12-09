import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { StabilityDepositChange, StabilityDeposit } from "../../generated/schema";

import { decimalize, DECIMAL_ZERO, BIGINT_ZERO } from "../utils/bignumbers";

import { beginChange, initChange, finishChange } from "./Change";
import { getUser } from "./User";
import { updateSystemStateByStabilityDepositChange } from "./SystemState";

function getCurrentStabilityDepositOfOwner(_user: Address): StabilityDeposit | null {
  let owner = getUser(_user);

  if (owner.currentStabilityDeposit == null) {
    return null;
  }

  return StabilityDeposit.load(owner.currentStabilityDeposit);
}

function openNewStabilityDepositForOwner(_user: Address): StabilityDeposit {
  let owner = getUser(_user);
  let stabilityDepositSubId = owner.stabilityDepositCount++;

  let newStabilityDeposit = new StabilityDeposit(
    _user.toHexString() + "-" + stabilityDepositSubId.toString()
  );
  newStabilityDeposit.owner = owner.id;
  newStabilityDeposit.depositedAmount = DECIMAL_ZERO;

  owner.currentStabilityDeposit = newStabilityDeposit.id;
  owner.save();

  return newStabilityDeposit;
}

function closeCurrentStabilityDepositOfOwner(_user: Address): void {
  let owner = getUser(_user);

  owner.currentStabilityDeposit = null;
  owner.save();
}

function createStabilityDepositChange(event: ethereum.Event): StabilityDepositChange {
  let sequenceNumber = beginChange(event);
  let stabilityDepositChange = new StabilityDepositChange(sequenceNumber.toString());
  initChange(stabilityDepositChange, event, sequenceNumber);

  return stabilityDepositChange;
}

function finishStabilityDepositChange(stabilityDepositChange: StabilityDepositChange): void {
  finishChange(stabilityDepositChange);
  stabilityDepositChange.save();
}

function updateStabilityDepositByOperation(
  event: ethereum.Event,
  stabilityDeposit: StabilityDeposit,
  operation: string,
  newDepositedAmount: BigDecimal,
  collateralGain: BigDecimal | null = null
): void {
  let stabilityDepositChange = createStabilityDepositChange(event);

  stabilityDepositChange.stabilityDeposit = stabilityDeposit.id;
  stabilityDepositChange.stabilityDepositOperation = operation;
  stabilityDepositChange.depositedAmountBefore = stabilityDeposit.depositedAmount;

  stabilityDeposit.depositedAmount = newDepositedAmount;

  stabilityDepositChange.depositedAmountAfter = stabilityDeposit.depositedAmount;
  stabilityDepositChange.depositedAmountChange = stabilityDepositChange.depositedAmountAfter.minus(
    stabilityDepositChange.depositedAmountBefore
  );

  if (collateralGain != null) {
    stabilityDepositChange.collateralGain = collateralGain;
  }

  updateSystemStateByStabilityDepositChange(stabilityDepositChange);
  finishStabilityDepositChange(stabilityDepositChange);
}

export function updateStabilityDeposit(
  event: ethereum.Event,
  _user: Address,
  _amount: BigInt
): void {
  let stabilityDepositOrNull = getCurrentStabilityDepositOfOwner(_user);
  let newDepositedAmount = decimalize(_amount);

  if (
    (stabilityDepositOrNull == null && newDepositedAmount == DECIMAL_ZERO) ||
    (stabilityDepositOrNull != null && newDepositedAmount == stabilityDepositOrNull.depositedAmount)
  ) {
    // Don't create a StabilityDepositChange when there's no change... duh.
    // It means user only wanted to withdraw collateral gains.
    return;
  }

  let stabilityDeposit =
    stabilityDepositOrNull != null
      ? (stabilityDepositOrNull as StabilityDeposit)
      : openNewStabilityDepositForOwner(_user);

  updateStabilityDepositByOperation(
    event,
    stabilityDeposit,
    newDepositedAmount > stabilityDeposit.depositedAmount ? "depositTokens" : "withdrawTokens",
    newDepositedAmount
  );

  if (newDepositedAmount == DECIMAL_ZERO) {
    closeCurrentStabilityDepositOfOwner(_user);
  }

  stabilityDeposit.save();
}

export function withdrawCollateralGainFromStabilityDeposit(
  event: ethereum.Event,
  _user: Address,
  _ETH: BigInt,
  _LUSDLoss: BigInt
): void {
  if (_ETH == BIGINT_ZERO && _LUSDLoss == BIGINT_ZERO) {
    // Ignore "NOP" event
    return;
  }

  let stabilityDeposit = getCurrentStabilityDepositOfOwner(_user) as StabilityDeposit;
  let depositLoss = decimalize(_LUSDLoss);
  let newDepositedAmount = stabilityDeposit.depositedAmount - depositLoss;

  updateStabilityDepositByOperation(
    event,
    stabilityDeposit,
    "withdrawCollateralGain",
    newDepositedAmount,
    decimalize(_ETH)
  );

  if (newDepositedAmount == DECIMAL_ZERO) {
    closeCurrentStabilityDepositOfOwner(_user);
  }

  stabilityDeposit.save();
}
