import { ethereum, Entity, Value, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { System, Transaction, PriceChange, Liquidation, Redemption } from "../../generated/schema";

import { decimalize, DECIMAL_INITIAL_PRICE, DECIMAL_ZERO } from "../utils/bignumbers";

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
    newSystem.redemptionCount = 0;
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
  system.currentPrice = decimalize(_newPrice);
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
  let currentLiquidation = getCurrentLiquidation(event);
  currentLiquidation.liquidatedCollateral = decimalize(_liquidatedColl);
  currentLiquidation.liquidatedDebt = decimalize(_liquidatedDebt);
  currentLiquidation.gasCompensation = decimalize(_gasCompensation);
  currentLiquidation.save();

  let system = getSystem();
  system.currentLiquidation = null;
  system.save();
}

function getRedemptionSequenceNumber(): i32 {
  return increaseCounter("redemptionCount");
}

export function getCurrentRedemption(event: ethereum.Event): Redemption {
  let currentRedemptionId = getSystem().currentRedemption;
  let currentRedemptionOrNull = Redemption.load(currentRedemptionId);

  if (currentRedemptionOrNull == null) {
    let sequenceNumber = getRedemptionSequenceNumber();
    let newRedemption = new Redemption(sequenceNumber.toString());

    newRedemption.sequenceNumber = sequenceNumber;
    newRedemption.transaction = getTransaction(event.transaction, event.block).id;
    newRedemption.redeemer = getUser(event.transaction.from).id;
    newRedemption.tokensAttemptedToRedeem = DECIMAL_ZERO;
    newRedemption.tokensActuallyRedeemed = DECIMAL_ZERO;
    newRedemption.collateralRedeemed = DECIMAL_ZERO;
    newRedemption.partial = false;
    newRedemption.save();

    let system = getSystem();
    system.currentRedemption = newRedemption.id;
    system.save();

    currentRedemptionOrNull = newRedemption;
  }

  return currentRedemptionOrNull as Redemption;
}

export function finishCurrentRedemption(
  event: ethereum.Event,
  _attemptedCLVAmount: BigInt,
  _actualCLVAmount: BigInt,
  _ETHSent: BigInt
): void {
  let currentRedemption = getCurrentRedemption(event);
  currentRedemption.tokensAttemptedToRedeem = decimalize(_attemptedCLVAmount);
  currentRedemption.tokensActuallyRedeemed = decimalize(_actualCLVAmount);
  currentRedemption.collateralRedeemed = decimalize(_ETHSent);
  currentRedemption.partial = _actualCLVAmount < _attemptedCLVAmount;
  currentRedemption.save();

  let system = getSystem();
  system.currentRedemption = null;
  system.save();
}
