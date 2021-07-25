import { ethereum, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import {
  SystemState,
  PriceChange,
  TroveChange,
  StabilityDepositChange,
  CollSurplusChange,
  LqtyStakeChange
} from "../../generated/schema";

import {
  decimalize,
  DECIMAL_ZERO,
  DECIMAL_ONE,
  DECIMAL_COLLATERAL_GAS_COMPENSATION_DIVISOR,
  DECIMAL_PRECISION
} from "../utils/bignumbers";

import { calculateCollateralRatio } from "../utils/collateralRatio";

import {
  isBorrowerOperation,
  isRedemption,
  isLiquidation,
  isRecoveryModeLiquidation
} from "../types/TroveOperation";

import { getGlobal, getSystemStateSequenceNumber } from "./Global";
import { beginChange, initChange, finishChange } from "./Change";

export function getCurrentSystemState(): SystemState {
  let currentSystemStateId = getGlobal().currentSystemState;
  let currentSystemStateOrNull = SystemState.load(currentSystemStateId);

  if (currentSystemStateOrNull == null) {
    let sequenceNumber = getSystemStateSequenceNumber();
    let newSystemState = new SystemState(sequenceNumber.toString());

    newSystemState.sequenceNumber = sequenceNumber;
    newSystemState.totalCollateral = DECIMAL_ZERO;
    newSystemState.totalDebt = DECIMAL_ZERO;
    newSystemState.tokensInStabilityPool = DECIMAL_ZERO;
    newSystemState.collSurplusPoolBalance = DECIMAL_ZERO;
    newSystemState.totalLQTYTokensStaked = DECIMAL_ZERO;
    newSystemState.save();

    let global = getGlobal();
    global.currentSystemState = newSystemState.id;
    global.save();

    currentSystemStateOrNull = newSystemState;
  }

  return currentSystemStateOrNull as SystemState;
}

function bumpSystemState(systemState: SystemState): void {
  let sequenceNumber = getSystemStateSequenceNumber();
  systemState.id = sequenceNumber.toString();
  systemState.sequenceNumber = sequenceNumber;
  systemState.save();

  let global = getGlobal();
  global.currentSystemState = systemState.id;
  global.save();
}

export function getCurrentPrice(): BigDecimal {
  let currentSystemState = getCurrentSystemState();

  // The backend always starts with fetching the latest price, so LastGoodPriceUpdated will be
  // the first event emitted. We can be sure that by the time we need the price, it will have been
  // initialized.
  return currentSystemState.price!;
}

function createPriceChange(event: ethereum.Event): PriceChange {
  let sequenceNumber = beginChange();
  let priceChange = new PriceChange(sequenceNumber.toString());
  initChange(priceChange, event, sequenceNumber);

  return priceChange;
}

function finishPriceChange(priceChange: PriceChange): void {
  finishChange(priceChange);
  priceChange.save();
}

/*
 * Update SystemState through a PriceChange if _lastGoodPrice is different from the last recorded
 * price.
 */
export function updatePrice(event: ethereum.Event, _lastGoodPrice: BigInt): void {
  let systemState = getCurrentSystemState();
  let oldPriceOrNull = systemState.price;
  let newPrice = decimalize(_lastGoodPrice);

  if (oldPriceOrNull == null) {
    // On first price event, just initialize price in the current system state without creating
    // a price change.
    systemState.price = newPrice;
    systemState.save();
    return;
  }

  let oldPrice = oldPriceOrNull!;

  if (newPrice != oldPrice) {
    let priceChange = createPriceChange(event);

    systemState.price = newPrice;
    bumpSystemState(systemState);

    priceChange.priceChange = newPrice.minus(oldPrice);
    finishPriceChange(priceChange);
  }
}

function tryToOffsetWithTokensFromStabilityPool(
  systemState: SystemState,
  collateralToLiquidate: BigDecimal,
  debtToLiquidate: BigDecimal
): void {
  if (debtToLiquidate <= systemState.tokensInStabilityPool) {
    // Completely offset
    systemState.totalCollateral = systemState.totalCollateral.minus(collateralToLiquidate);
    systemState.totalDebt = systemState.totalDebt.minus(debtToLiquidate);
    systemState.tokensInStabilityPool = systemState.tokensInStabilityPool.minus(debtToLiquidate);
  } else if (systemState.tokensInStabilityPool > DECIMAL_ZERO) {
    // Partially offset, emptying the pool
    systemState.totalCollateral = systemState.totalCollateral.minus(
      collateralToLiquidate
        .times(systemState.tokensInStabilityPool)
        .div(debtToLiquidate)
        .truncate(DECIMAL_PRECISION)
    );
    systemState.totalDebt = systemState.totalDebt.minus(systemState.tokensInStabilityPool);
    systemState.tokensInStabilityPool = DECIMAL_ZERO;
  } else {
    // Empty pool
  }
}

export function updateSystemStateByTroveChange(troveChange: TroveChange): void {
  let systemState = getCurrentSystemState();
  let operation = troveChange.troveOperation;

  if (isBorrowerOperation(operation) || isRedemption(operation)) {
    systemState.totalCollateral = systemState.totalCollateral.plus(troveChange.collateralChange);
    systemState.totalDebt = systemState.totalDebt.plus(troveChange.debtChange);
  } else if (isLiquidation(operation)) {
    let collateral = troveChange.collateralBefore;
    let debt = troveChange.debtBefore;
    let collateralGasCompensation = collateral
      .div(DECIMAL_COLLATERAL_GAS_COMPENSATION_DIVISOR)
      .truncate(DECIMAL_PRECISION);

    systemState.totalCollateral = systemState.totalCollateral.minus(collateralGasCompensation);

    if (!isRecoveryModeLiquidation(operation) || troveChange.collateralRatioBefore > DECIMAL_ONE) {
      tryToOffsetWithTokensFromStabilityPool(
        systemState,
        collateral.minus(collateralGasCompensation),
        debt
      );
    }
  }

  systemState.totalCollateralRatio = calculateCollateralRatio(
    systemState.totalCollateral,
    systemState.totalDebt,
    systemState.price! // A trove change is guaranteed to be preceeded by a price update
  );

  bumpSystemState(systemState);
}

export function updateSystemStateByStabilityDepositChange(
  stabilityDepositChange: StabilityDepositChange
): void {
  let systemState = getCurrentSystemState();
  let operation = stabilityDepositChange.stabilityDepositOperation;

  if (operation == "depositTokens" || operation == "withdrawTokens") {
    systemState.tokensInStabilityPool = systemState.tokensInStabilityPool.plus(
      stabilityDepositChange.depositedAmountChange
    );
  }

  bumpSystemState(systemState);
}

export function updateSystemStateByCollSurplusChange(collSurplusChange: CollSurplusChange): void {
  let systemState = getCurrentSystemState();

  systemState.collSurplusPoolBalance = systemState.collSurplusPoolBalance.plus(
    collSurplusChange.collSurplusChange
  );

  bumpSystemState(systemState);
}

export function updateSystemStateByLqtyStakeChange(stakeChange: LqtyStakeChange): void {
  let systemState = getCurrentSystemState();

  systemState.totalLQTYTokensStaked = systemState.totalLQTYTokensStaked.plus(
    stakeChange.stakedAmountChange
  );

  bumpSystemState(systemState);
}
