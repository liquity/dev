import { ethereum, Entity, Value } from "@graphprotocol/graph-ts";

import { System, Transaction } from "../../generated/schema";

const onlySystemId = "only";

function getSystem(): System {
  let systemOrNull = System.load(onlySystemId);

  if (systemOrNull != null) {
    return systemOrNull as System;
  } else {
    let newSystem = new System(onlySystemId);

    newSystem.transactionCount = 0;
    newSystem.changeCount = 0;

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

    return newTransaction;
  }
}

export function getChangeId(event: ethereum.Event): string {
  return event.transaction.hash.toHex() + "-" + event.logIndex.toString();
}

export function initChange(change: Entity, event: ethereum.Event): void {
  let transaction = getTransaction(event.transaction, event.block);

  change.set("sequenceNumber", Value.fromI32(increaseCounter("changeCount")));
  change.set("transaction", Value.fromString(transaction.id));

  transaction.save();
}
