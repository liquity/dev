import { CDPManager } from "../../generated/CDPManager/CDPManager";
import {
  BorrowerOperations,
  CDPUpdated
} from "../../generated/templates/BorrowerOperations/BorrowerOperations";

import { getTroveOperationFromBorrowerOperation } from "../types/TroveOperation";

import { updateTrove } from "../entities/Trove";

export function handleCDPUpdated(event: CDPUpdated): void {
  let borrowerOperations = BorrowerOperations.bind(event.address);
  let cdpManagerAddress = borrowerOperations.cdpManager();
  let cdpManager = CDPManager.bind(cdpManagerAddress);
  let snapshots = cdpManager.rewardSnapshots(event.params._user);

  updateTrove(
    event,
    getTroveOperationFromBorrowerOperation(event.params.operation),
    event.params._user,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}
