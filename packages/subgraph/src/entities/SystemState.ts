import { ethereum, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import {
  SystemState,
  PriceChange,
  TroveChange,
  StabilityDepositChange
} from "../../generated/schema";

import { decimalize, DECIMAL_INITIAL_PRICE, DECIMAL_ZERO, DECIMAL_ONE } from "../utils/bignumbers";
import { calculateCollateralRatio } from "../utils/collateralRatio";

import {
  isBorrowerOperation,
  isRedemption,
  isLiquidation,
  isRecoveryModeLiquidation
} from "../types/TroveOperation";

import { getGlobal, getSystemStateSequenceNumber, getChangeSequenceNumber } from "./Global";
import { initChange, finishChange } from "./Change";

export function getCurrentSystemState(): SystemState {
  let currentSystemStateId = getGlobal().currentSystemState;
  let currentSystemStateOrNull = SystemState.load(currentSystemStateId);

  if (currentSystemStateOrNull == null) {
    let sequenceNumber = getSystemStateSequenceNumber();
    let newSystemState = new SystemState(sequenceNumber.toString());

    newSystemState.sequenceNumber = sequenceNumber;
    newSystemState.price = DECIMAL_INITIAL_PRICE;
    newSystemState.totalCollateral = DECIMAL_ZERO;
    newSystemState.totalDebt = DECIMAL_ZERO;
    newSystemState.tokensInStabilityPool = DECIMAL_ZERO;
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

  return currentSystemState.price;
}

function createPriceChange(event: ethereum.Event): PriceChange {
  let sequenceNumber = getChangeSequenceNumber();
  let priceChange = new PriceChange(sequenceNumber.toString());
  initChange(priceChange, event, sequenceNumber);

  return priceChange;
}

function finishPriceChange(priceChange: PriceChange): void {
  finishChange(priceChange);
  priceChange.save();
}

// export function updatePrice(event: ethereum.Event, _newPrice: BigInt): void {
//   let priceChange = createPriceChange(event);

//   let systemState = getCurrentSystemState();
//   let oldPrice = systemState.price;
//   let newPrice = decimalize(_newPrice);

//   systemState.price = newPrice;
//   bumpSystemState(systemState);

//   priceChange.priceChange = newPrice - oldPrice;
//   finishPriceChange(priceChange);
// }

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
    systemState.price
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
