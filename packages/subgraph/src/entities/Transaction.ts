import { ethereum } from "@graphprotocol/graph-ts";

import { Transaction } from "../../generated/schema";

import { getTransactionSequenceNumber } from "./Global";

/*
 * Return existing entity for the transaction that emitted this event, or create and return a new
 * one if none exists yet.
 */
export function getTransaction(event: ethereum.Event): Transaction {
  let transactionId = event.transaction.hash.toHex();
  let transactionOrNull = Transaction.load(transactionId);

  if (transactionOrNull != null) {
    return transactionOrNull as Transaction;
  } else {
    let newTransaction = new Transaction(transactionId);

    newTransaction.sequenceNumber = getTransactionSequenceNumber();
    newTransaction.blockNumber = event.block.number.toI32();
    newTransaction.timestamp = event.block.timestamp.toI32();
    newTransaction.save();

    return newTransaction;
  }
}
