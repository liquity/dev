import {
  CDPManager,
  CDPUpdated,
  CDPLiquidated,
  BorrowerOperationsAddressChanged,
  PoolManagerAddressChanged,
  PriceFeedAddressChanged
} from "../../generated/CDPManager/CDPManager";
import { BorrowerOperations, PoolManager, PriceFeed } from "../../generated/templates";

import { updateTrove } from "../entities/Trove";
import { BIGINT_ZERO } from "../utils/bignumbers";

enum CDPManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  partiallyLiquidateInRecoveryMode,
  redeemCollateral
}

function getTroveOperation(operation: CDPManagerOperation): string {
  switch (operation) {
    case CDPManagerOperation.applyPendingRewards:
      return "accrueRewards";
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

export function handlePoolManagerAddressChanged(event: PoolManagerAddressChanged): void {
  PoolManager.create(event.params._newPoolManagerAddress);
}

export function handlePriceFeedAddressChanged(event: PriceFeedAddressChanged): void {
  PriceFeed.create(event.params._newPriceFeedAddress);
}

export function handleCDPUpdated(event: CDPUpdated): void {
  let cdpManager = CDPManager.bind(event.address);
  let snapshots = cdpManager.rewardSnapshots(event.params._user);

  updateTrove(
    event,
    getTroveOperation(event.params.operation),
    event.params._user,
    event.params._coll,
    event.params._debt,
    event.params.stake,
    snapshots.value0,
    snapshots.value1
  );
}

export function handleCDPLiquidated(event: CDPLiquidated): void {
  updateTrove(
    event,
    "accrueRewards",
    event.params._user,
    event.params._coll,
    event.params._debt,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );

  updateTrove(
    event,
    getTroveOperation(event.params.operation),
    event.params._user,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );
}
