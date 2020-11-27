import {
  CDPManager,
  CDPUpdated,
  CDPLiquidated,
  Liquidation,
  Redemption,
  BorrowerOperationsAddressChanged,
  StabilityPoolAddressChanged,
  PriceFeedAddressChanged
} from "../../generated/CDPManager/CDPManager";
import { BorrowerOperations, StabilityPool, PriceFeed } from "../../generated/templates";

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

export function handleStabilityPoolAddressChanged(event: StabilityPoolAddressChanged): void {
  StabilityPool.create(event.params._stabilityPoolAddress);
}

export function handlePriceFeedAddressChanged(event: PriceFeedAddressChanged): void {
  PriceFeed.create(event.params._newPriceFeedAddress);
}

export function handleCDPUpdated(event: CDPUpdated): void {
  let cdpManager = CDPManager.bind(event.address);
  let snapshots = cdpManager.rewardSnapshots(event.params._borrower);

  updateTrove(
    event,
    getTroveOperationFromCDPManagerOperation(event.params._operation),
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    event.params._stake,
    snapshots.value0,
    snapshots.value1
  );
}

export function handleCDPLiquidated(event: CDPLiquidated): void {
  updateTrove(
    event,
    "accrueRewards",
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );

  updateTrove(
    event,
    getTroveOperationFromCDPManagerOperation(event.params._operation),
    event.params._borrower,
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
    event.params._collGasCompensation,
    event.params._CLVGasCompensation
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
