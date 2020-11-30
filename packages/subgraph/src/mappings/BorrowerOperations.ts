import { TroveManager } from "../../generated/TroveManager/TroveManager";
import {
  BorrowerOperations,
  TroveUpdated
} from "../../generated/templates/BorrowerOperations/BorrowerOperations";

import { getTroveOperationFromBorrowerOperation } from "../types/TroveOperation";

import { updateTrove } from "../entities/Trove";

export function handleTroveUpdated(event: TroveUpdated): void {
  let borrowerOperations = BorrowerOperations.bind(event.address);
  let troveManagerAddress = borrowerOperations.troveManager();
  let troveManager = TroveManager.bind(troveManagerAddress);
  let snapshots = troveManager.rewardSnapshots(event.params._borrower);

  updateTrove(
    event,
    getTroveOperationFromBorrowerOperation(event.params.operation),
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}
