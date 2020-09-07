import { ethereum, Entity, Value, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { System, PriceChange } from "../../generated/schema";

import { decimalize, DECIMAL_INITIAL_PRICE } from "../utils/bignumbers";

import { getTransaction } from "./Transaction";

const onlySystemId = "only";

export function getSystem(): System {
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

export function getTransactionSequenceNumber(): i32 {
  return increaseCounter("transactionCount");
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

export function getLiquidationSequenceNumber(): i32 {
  return increaseCounter("liquidationCount");
}

export function getRedemptionSequenceNumber(): i32 {
  return increaseCounter("redemptionCount");
}
