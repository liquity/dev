import { ethereum, BigDecimal, BigInt } from "@graphprotocol/graph-ts";

import {
  SystemState,
  PriceChange,
  TroveChange,
  StabilityDepositChange,
  CollSurplusChange
} from "../../generated/schema";

import { decimalize, DECIMAL_ZERO, DECIMAL_ONE } from "../utils/bignumbers";
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
    newSystemState.save();

    let global = getGlobal();
    global.currentSystemState = newSystemState.id;
    global.save();

    currentSystemStateOrNull = newSystemState;
  }

  return currentSystemStateOrNull as SystemState;
}

export function bumpSystemState(systemState: SystemState): void {
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
    systemState.totalCollateral -= collateralToLiquidate;
    systemState.totalDebt -= debtToLiquidate;
    systemState.tokensInStabilityPool -= debtToLiquidate;
  } else if (systemState.tokensInStabilityPool > DECIMAL_ZERO) {
    // Partially offset, emptying the pool
    systemState.totalCollateral -=
      (collateralToLiquidate * systemState.tokensInStabilityPool) / debtToLiquidate;
    systemState.totalDebt -= systemState.tokensInStabilityPool;
    systemState.tokensInStabilityPool = DECIMAL_ZERO;
  } else {
    // Empty pool
  }
}

export function updateSystemStateByTroveChange(troveChange: TroveChange): void {
  let systemState = getCurrentSystemState();
  let operation = troveChange.troveOperation;

  if (isBorrowerOperation(operation) || isRedemption(operation)) {
    systemState.totalCollateral += troveChange.collateralChange;
    systemState.totalDebt += troveChange.debtChange;
  } else if (isLiquidation(operation)) {
    // TODO gas compensation
    if (!isRecoveryModeLiquidation(operation) || troveChange.collateralRatioBefore > DECIMAL_ONE) {
      tryToOffsetWithTokensFromStabilityPool(
        systemState,
        -troveChange.collateralChange,
        -troveChange.debtChange
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
    systemState.tokensInStabilityPool += stabilityDepositChange.depositedAmountChange;
  }

  bumpSystemState(systemState);
}

export function updateSystemStateByCollSurplusChange(collSurplusChange: CollSurplusChange): void {
  let systemState = getCurrentSystemState();

  systemState.collSurplusPoolBalance += collSurplusChange.collSurplusChange;

  bumpSystemState(systemState);
}
