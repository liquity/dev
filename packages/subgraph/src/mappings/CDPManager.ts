import {
  CDPManager,
  CDPUpdated,
  BorrowerOperationsAddressChanged
} from "../../generated/CDPManager/CDPManager";
import { BorrowerOperations } from "../../generated/templates";

import { updateTrove } from "../entities/Trove";

enum CDPManagerOperation {
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  partiallyLiquidateInRecoveryMode,
  redeemCollateral
}

function getTroveOperation(operation: CDPManagerOperation): string {
  switch (operation) {
    case CDPManagerOperation.liquidateInNormalMode:
      return "liquidateInNormalMode";
    case CDPManagerOperation.liquidateInRecoveryMode:
      return "liquidateInRecoveryMode";
    case CDPManagerOperation.partiallyLiquidateInRecoveryMode:
      return "partiallyLiquidateInRecoveryMode";
    case CDPManagerOperation.redeemCollateral:
      return "redeemCollateral";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function handleBorrowerOperationsAddressChanged(
  event: BorrowerOperationsAddressChanged
): void {
  BorrowerOperations.create(event.params._newBorrowerOperationsAddress);
}

export function handleCDPUpdated(event: CDPUpdated): void {
  let cdpManager = CDPManager.bind(event.address);
  let snapshots = cdpManager.rewardSnapshots(event.params._user);

  updateTrove(
    event.transaction.hash,
    event.logIndex,
    getTroveOperation(event.params.operation),
    event.params._user,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}
