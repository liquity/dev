import { ethereum, Entity, Value } from "@graphprotocol/graph-ts";

import { getChangeSequenceNumber } from "./Global";
import { getTransaction } from "./Transaction";
import { getCurrentSystemState } from "./SystemState";

export function beginChange(event: ethereum.Event): i32 {
  // Pre-create the Transaction entity that this change will eventually refer to (if it doesn't
  // exist yet).

  // This is needed because creating a new Transaction may have the side effect of increasing the
  // change sequence number through creating a PriceChange.
  getTransaction(event);

  return getChangeSequenceNumber();
}

export function initChange(change: Entity, event: ethereum.Event, sequenceNumber: i32): void {
  let transactionId = getTransaction(event).id;
  let systemStateBeforeId = getCurrentSystemState().id;

  change.set("sequenceNumber", Value.fromI32(sequenceNumber));
  change.set("transaction", Value.fromString(transactionId));
  change.set("systemStateBefore", Value.fromString(systemStateBeforeId));
}

export function finishChange(change: Entity): void {
  let systemStateAfterId = getCurrentSystemState().id;

  change.set("systemStateAfter", Value.fromString(systemStateAfterId));
}
