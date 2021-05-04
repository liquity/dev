import { TroveManager } from "../../generated/TroveManager/TroveManager";
import {
  BorrowerOperations,
  TroveUpdated,
  LUSDBorrowingFeePaid
} from "../../generated/BorrowerOperations/BorrowerOperations";

import { getTroveOperationFromBorrowerOperation } from "../types/TroveOperation";

import { setBorrowingFeeOfLastTroveChange, updateTrove } from "../entities/Trove";
import { increaseTotalBorrowingFeesPaid } from "../entities/Global";

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

export function handleLUSDBorrowingFeePaid(event: LUSDBorrowingFeePaid): void {
  setBorrowingFeeOfLastTroveChange(event.params._LUSDFee);
  increaseTotalBorrowingFeesPaid(event.params._LUSDFee);
}
