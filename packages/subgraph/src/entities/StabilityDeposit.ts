import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { StabilityDepositChange, StabilityDeposit } from "../../generated/schema";

import { DECIMAL_SCALING_FACTOR, DECIMAL_ZERO, BIGINT_ZERO } from "../utils/bignumbers";

import { getChangeSequenceNumber, initChange } from "./System";
import { getCurrentStabilityDepositOfOwner, closeCurrentStabilityDepositOfOwner } from "./User";

function createStabilityDepositChange(event: ethereum.Event): StabilityDepositChange {
  let sequenceNumber = getChangeSequenceNumber();
  let stabilityDepositChange = new StabilityDepositChange(sequenceNumber.toString());
  initChange(stabilityDepositChange, event, sequenceNumber);

  return stabilityDepositChange;
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

  stabilityDepositChange.save();
}

export function updateStabilityDeposit(
  event: ethereum.Event,
  _user: Address,
  _amount: BigInt
): void {
  let stabilityDeposit = getCurrentStabilityDepositOfOwner(_user);
  let newDepositedAmount = _amount.divDecimal(DECIMAL_SCALING_FACTOR);

  if (newDepositedAmount == stabilityDeposit.depositedAmount) {
    // Don't create a StabilityDepositChange when there's no change... duh.
    // It means user only wanted to withdraw collateral gains.
    return;
  }

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
  _CLVLoss: BigInt
): void {
  if (_ETH == BIGINT_ZERO && _CLVLoss == BIGINT_ZERO) {
    // Ignore "NOP" event
    return;
  }

  let stabilityDeposit = getCurrentStabilityDepositOfOwner(_user);
  let depositLoss = _CLVLoss.divDecimal(DECIMAL_SCALING_FACTOR);
  let newDepositedAmount = stabilityDeposit.depositedAmount - depositLoss;

  updateStabilityDepositByOperation(
    event,
    stabilityDeposit,
    "withdrawCollateralGain",
    newDepositedAmount,
    _ETH.divDecimal(DECIMAL_SCALING_FACTOR)
  );

  if (newDepositedAmount == DECIMAL_ZERO) {
    closeCurrentStabilityDepositOfOwner(_user);
  }

  stabilityDeposit.save();
}
