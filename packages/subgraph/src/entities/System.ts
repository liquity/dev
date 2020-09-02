import { ethereum, Entity, Value, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { System, Transaction, PriceChange, Liquidation } from "../../generated/schema";

import { DECIMAL_INITIAL_PRICE, DECIMAL_SCALING_FACTOR, DECIMAL_ZERO } from "../utils/bignumbers";

import { getUser } from "./User";

const onlySystemId = "only";

function getSystem(): System {
  let systemOrNull = System.load(onlySystemId);

  if (systemOrNull != null) {
    return systemOrNull as System;
  } else {
    let newSystem = new System(onlySystemId);

    newSystem.transactionCount = 0;
    newSystem.changeCount = 0;
    newSystem.liquidationCount = 0;
    newSystem.currentPrice = DECIMAL_INITIAL_PRICE;

    return newSystem;
  }
}

function increaseCounter(key: string): i32 {
  let system = getSystem();

  let count = system.get(key).toI32();
  system.set(key, Value.fromI32(count + 1));
  system.save();

  return count;
}

function getTransaction(ethTransaction: ethereum.Transaction, block: ethereum.Block): Transaction {
  let transactionId = ethTransaction.hash.toHex();
  let transactionOrNull = Transaction.load(transactionId);

  if (transactionOrNull != null) {
    return transactionOrNull as Transaction;
  } else {
    let newTransaction = new Transaction(transactionId);

    newTransaction.sequenceNumber = increaseCounter("transactionCount");
    newTransaction.blockNumber = block.number.toI32();
    newTransaction.timestamp = block.timestamp.toI32();
    newTransaction.save();

    return newTransaction;
  }
}

export function getChangeSequenceNumber(): i32 {
  return increaseCounter("changeCount");
}

export function initChange(change: Entity, event: ethereum.Event, sequenceNumber: i32): void {
  let transactionId = getTransaction(event.transaction, event.block).id;

  change.set("sequenceNumber", Value.fromI32(sequenceNumber));
  change.set("transaction", Value.fromString(transactionId));
}

export function getCurrentPrice(): BigDecimal {
  let system = getSystem();

  return system.currentPrice;
}

function createPriceChange(event: ethereum.Event): PriceChange {
  let sequenceNumber = getChangeSequenceNumber();
  let priceChange = new PriceChange(sequenceNumber.toString());
  initChange(priceChange, event, sequenceNumber);

  return priceChange;
}

export function updatePrice(event: ethereum.Event, _newPrice: BigInt): void {
  let priceChange = createPriceChange(event);

  let system = getSystem();
  priceChange.priceBefore = system.currentPrice;
  system.currentPrice = _newPrice.divDecimal(DECIMAL_SCALING_FACTOR);
  priceChange.priceAfter = system.currentPrice;
  priceChange.priceChange = priceChange.priceAfter - priceChange.priceBefore;
  system.save();

  priceChange.save();
}

function getLiquidationSequenceNumber(): i32 {
  return increaseCounter("liquidationCount");
}

export function getCurrentLiquidation(event: ethereum.Event): Liquidation {
  let currentLiquidationId = getSystem().currentLiquidation;
  let currentLiquidationOrNull = Liquidation.load(currentLiquidationId);

  if (currentLiquidationOrNull == null) {
    let sequenceNumber = getLiquidationSequenceNumber();
    let newLiquidation = new Liquidation(sequenceNumber.toString());

    newLiquidation.sequenceNumber = sequenceNumber;
    newLiquidation.transaction = getTransaction(event.transaction, event.block).id;
    newLiquidation.liquidator = getUser(event.transaction.from).id;
    newLiquidation.liquidatedCollateral = DECIMAL_ZERO;
    newLiquidation.liquidatedDebt = DECIMAL_ZERO;
    newLiquidation.gasCompensation = DECIMAL_ZERO;
    newLiquidation.save();

    let system = getSystem();
    system.currentLiquidation = newLiquidation.id;
    system.save();

    currentLiquidationOrNull = newLiquidation;
  }

  return currentLiquidationOrNull as Liquidation;
}

export function finishCurrentLiquidation(
  event: ethereum.Event,
  _liquidatedColl: BigInt,
  _liquidatedDebt: BigInt,
  _gasCompensation: BigInt
): void {
  let system = getSystem();
  let currentLiquidation = getCurrentLiquidation(event);

  currentLiquidation.liquidatedCollateral = _liquidatedColl.divDecimal(DECIMAL_SCALING_FACTOR);
  currentLiquidation.liquidatedDebt = _liquidatedDebt.divDecimal(DECIMAL_SCALING_FACTOR);
  currentLiquidation.gasCompensation = _gasCompensation.divDecimal(DECIMAL_SCALING_FACTOR);
  currentLiquidation.save();

  system.currentLiquidation = null;
  system.save();
}
