import { ethereum } from "@graphprotocol/graph-ts";

import { Transaction } from "../../generated/schema";

import { getTransactionSequenceNumber } from "./Global";

export function getTransaction(
  ethTransaction: ethereum.Transaction,
  block: ethereum.Block
): Transaction {
  let transactionId = ethTransaction.hash.toHex();
  let transactionOrNull = Transaction.load(transactionId);

  if (transactionOrNull != null) {
    return transactionOrNull as Transaction;
  } else {
    let newTransaction = new Transaction(transactionId);

    newTransaction.sequenceNumber = getTransactionSequenceNumber();
    newTransaction.blockNumber = block.number.toI32();
    newTransaction.timestamp = block.timestamp.toI32();
    newTransaction.save();

    return newTransaction;
  }
}
