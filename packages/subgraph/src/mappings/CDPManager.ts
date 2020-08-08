import {
  CDPManager,
  CDPUpdated,
  BorrowerOperationsAddressChanged
} from "../../generated/CDPManager/CDPManager";
import { BorrowerOperations } from "../../generated/templates";

import { updateTrove } from "../entities/Trove";

export function handleBorrowerOperationsAddressChanged(
  event: BorrowerOperationsAddressChanged
): void {
  BorrowerOperations.create(event.params._newBorrowerOperationsAddress);
}

export function handleCDPUpdated(event: CDPUpdated): void {
  let cdpManager = CDPManager.bind(event.address);
  let snapshots = cdpManager.rewardSnapshots(event.params._user);

  updateTrove(
    event.params._user,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}
