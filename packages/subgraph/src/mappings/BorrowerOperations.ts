import { CDPManager } from "../../generated/CDPManager/CDPManager";
import {
  BorrowerOperations,
  CDPUpdated
} from "../../generated/templates/BorrowerOperations/BorrowerOperations";

import { updateTrove } from "../entities/Trove";

enum BorrowerOperation {
  openLoan,
  closeLoan,
  addColl,
  withdrawColl,
  withdrawCLV,
  repayCLV,
  adjustLoan
}

function getTroveOperation(operation: BorrowerOperation): string {
  switch (operation) {
    case BorrowerOperation.openLoan:
      return "openLoan";
    case BorrowerOperation.closeLoan:
      return "closeLoan";
    case BorrowerOperation.addColl:
      return "depositCollateral";
    case BorrowerOperation.withdrawColl:
      return "withdrawCollateral";
    case BorrowerOperation.withdrawCLV:
      return "mint";
    case BorrowerOperation.repayCLV:
      return "repay";
    case BorrowerOperation.adjustLoan:
      return "adjustLoan";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function handleCDPUpdated(event: CDPUpdated): void {
  let borrowerOperations = BorrowerOperations.bind(event.address);
  let cdpManagerAddress = borrowerOperations.cdpManagerAddress();
  let cdpManager = CDPManager.bind(cdpManagerAddress);
  let snapshots = cdpManager.rewardSnapshots(event.params._user);

  updateTrove(
    event.block.timestamp,
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
