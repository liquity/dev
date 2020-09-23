import {
  CDPManager,
  CDPUpdated,
  CDPLiquidated,
  Liquidation,
  Redemption,
  BorrowerOperationsAddressChanged,
  PoolManagerAddressChanged,
  PriceFeedAddressChanged
} from "../../generated/CDPManager/CDPManager";
import { BorrowerOperations, PoolManager, PriceFeed } from "../../generated/templates";

import { BIGINT_ZERO } from "../utils/bignumbers";

import { getTroveOperationFromCDPManagerOperation } from "../types/TroveOperation";

import { finishCurrentLiquidation } from "../entities/Liquidation";
import { finishCurrentRedemption } from "../entities/Redemption";
import { updateTrove } from "../entities/Trove";
import { updateTotalRedistributed } from "../entities/Global";

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
    getTroveOperationFromCDPManagerOperation(event.params.operation),
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
    getTroveOperationFromCDPManagerOperation(event.params.operation),
    event.params._user,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );
}

export function handleLiquidation(event: Liquidation): void {
  let cdpManager = CDPManager.bind(event.address);

  finishCurrentLiquidation(
    event,
    event.params._liquidatedColl,
    event.params._liquidatedDebt,
    event.params._gasCompensation
  );

  updateTotalRedistributed(cdpManager.L_ETH(), cdpManager.L_CLVDebt());
}

export function handleRedemption(event: Redemption): void {
  finishCurrentRedemption(
    event,
    event.params._attemptedCLVAmount,
    event.params._actualCLVAmount,
    event.params._ETHSent
  );
}
