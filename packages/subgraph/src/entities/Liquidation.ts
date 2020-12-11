import { ethereum, BigInt } from "@graphprotocol/graph-ts";

import { Liquidation } from "../../generated/schema";

import { decimalize, DECIMAL_ZERO } from "../utils/bignumbers";

import { getGlobal, getLiquidationSequenceNumber } from "./Global";
import { getTransaction } from "./Transaction";
import { getUser } from "./User";

export function getCurrentLiquidation(event: ethereum.Event): Liquidation {
  let currentLiquidationId = getGlobal().currentLiquidation;
  let currentLiquidationOrNull = Liquidation.load(currentLiquidationId);

  if (currentLiquidationOrNull == null) {
    let sequenceNumber = getLiquidationSequenceNumber();
    let newLiquidation = new Liquidation(sequenceNumber.toString());

    newLiquidation.sequenceNumber = sequenceNumber;
    newLiquidation.transaction = getTransaction(event).id;
    newLiquidation.liquidator = getUser(event.transaction.from).id;
    newLiquidation.liquidatedCollateral = DECIMAL_ZERO;
    newLiquidation.liquidatedDebt = DECIMAL_ZERO;
    newLiquidation.collGasCompensation = DECIMAL_ZERO;
    newLiquidation.tokenGasCompensation = DECIMAL_ZERO;
    newLiquidation.save();

    let global = getGlobal();
    global.currentLiquidation = newLiquidation.id;
    global.save();

    currentLiquidationOrNull = newLiquidation;
  }

  return currentLiquidationOrNull as Liquidation;
}

export function finishCurrentLiquidation(
  event: ethereum.Event,
  _liquidatedColl: BigInt,
  _liquidatedDebt: BigInt,
  _collGasCompensation: BigInt,
  _LUSDGasCompensation: BigInt
): void {
  let currentLiquidation = getCurrentLiquidation(event);
  currentLiquidation.liquidatedCollateral = decimalize(_liquidatedColl);
  currentLiquidation.liquidatedDebt = decimalize(_liquidatedDebt);
  currentLiquidation.collGasCompensation = decimalize(_collGasCompensation);
  currentLiquidation.tokenGasCompensation = decimalize(_LUSDGasCompensation);
  currentLiquidation.save();

  let global = getGlobal();
  global.currentLiquidation = null;
  global.save();
}
