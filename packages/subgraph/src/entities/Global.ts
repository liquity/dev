import { Value, BigInt, Address } from "@graphprotocol/graph-ts";

import { Global } from "../../generated/schema";

import { BIGINT_ZERO } from "../utils/bignumbers";

const onlyGlobalId = "only";

export function getGlobal(): Global {
  let globalOrNull = Global.load(onlyGlobalId);

  if (globalOrNull != null) {
    return globalOrNull as Global;
  } else {
    let newGlobal = new Global(onlyGlobalId);

    newGlobal.systemStateCount = 0;
    newGlobal.transactionCount = 0;
    newGlobal.changeCount = 0;
    newGlobal.liquidationCount = 0;
    newGlobal.redemptionCount = 0;
    newGlobal.numberOfOpenTroves = 0;
    newGlobal.numberOfLiquidatedTroves = 0;
    newGlobal.numberOfRedeemedTroves = 0;
    newGlobal.numberOfTrovesClosedByOwner = 0;
    newGlobal.totalNumberOfTroves = 0;
    newGlobal.rawTotalRedistributedCollateral = BIGINT_ZERO;
    newGlobal.rawTotalRedistributedDebt = BIGINT_ZERO;

    return newGlobal;
  }
}

function increaseCounter(key: string): i32 {
  let global = getGlobal();

  let count = global.get(key).toI32();
  global.set(key, Value.fromI32(count + 1));
  global.save();

  return count;
}

export function getSystemStateSequenceNumber(): i32 {
  return increaseCounter("systemStateCount");
}

export function getTransactionSequenceNumber(): i32 {
  return increaseCounter("transactionCount");
}

export function getChangeSequenceNumber(): i32 {
  return increaseCounter("changeCount");
}

export function getLiquidationSequenceNumber(): i32 {
  return increaseCounter("liquidationCount");
}

export function getRedemptionSequenceNumber(): i32 {
  return increaseCounter("redemptionCount");
}

export function updatePriceFeedAddress(priceFeedAddress: Address): void {
  let global = getGlobal();

  global.priceFeedAddress = priceFeedAddress;
  global.save();
}

export function getPriceFeedAddress(): Address {
  return getGlobal().priceFeedAddress as Address;
}

export function updateTotalRedistributed(L_ETH: BigInt, L_LUSDDebt: BigInt): void {
  let global = getGlobal();

  global.rawTotalRedistributedCollateral = L_ETH;
  global.rawTotalRedistributedDebt = L_LUSDDebt;
  global.save();
}

export function increaseNumberOfOpenTroves(): void {
  let global = getGlobal();

  global.numberOfOpenTroves++;
  global.totalNumberOfTroves++;
  global.save();
}

export function increaseNumberOfLiquidatedTroves(): void {
  let global = getGlobal();

  global.numberOfLiquidatedTroves++;
  global.numberOfOpenTroves--;
  global.save();
}

export function increaseNumberOfRedeemedTroves(): void {
  let global = getGlobal();

  global.numberOfRedeemedTroves++;
  global.numberOfOpenTroves--;
  global.save();
}

export function increaseNumberOfTrovesClosedByOwner(): void {
  let global = getGlobal();

  global.numberOfTrovesClosedByOwner++;
  global.numberOfOpenTroves--;
  global.save();
}
