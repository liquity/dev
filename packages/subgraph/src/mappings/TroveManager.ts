import {
  TroveManager,
  TroveUpdated,
  TroveLiquidated,
  Liquidation,
  Redemption,
  BorrowerOperationsAddressChanged,
  StabilityPoolAddressChanged,
  CollSurplusPoolAddressChanged,
  PriceFeedAddressChanged
} from "../../generated/TroveManager/TroveManager";
import { BorrowerOperations, StabilityPool, CollSurplusPool } from "../../generated/templates";

import { BIGINT_ZERO } from "../utils/bignumbers";

import { getTroveOperationFromTroveManagerOperation } from "../types/TroveOperation";

import { finishCurrentLiquidation } from "../entities/Liquidation";
import { finishCurrentRedemption } from "../entities/Redemption";
import { updateTrove } from "../entities/Trove";
import { updatePriceFeedAddress, updateTotalRedistributed } from "../entities/Global";

export function handleBorrowerOperationsAddressChanged(
  event: BorrowerOperationsAddressChanged
): void {
  BorrowerOperations.create(event.params._newBorrowerOperationsAddress);
}

export function handleStabilityPoolAddressChanged(event: StabilityPoolAddressChanged): void {
  StabilityPool.create(event.params._stabilityPoolAddress);
}

export function handleCollSurplusPoolAddressChanged(event: CollSurplusPoolAddressChanged): void {
  CollSurplusPool.create(event.params._collSurplusPoolAddress);
}

export function handlePriceFeedAddressChanged(event: PriceFeedAddressChanged): void {
  updatePriceFeedAddress(event.params._newPriceFeedAddress);
}

export function handleTroveUpdated(event: TroveUpdated): void {
  let troveManager = TroveManager.bind(event.address);
  let snapshots = troveManager.rewardSnapshots(event.params._borrower);

  updateTrove(
    event,
    getTroveOperationFromTroveManagerOperation(event.params._operation),
    event.params._borrower,
    event.params._coll,
    event.params._debt,
    event.params._stake,
    snapshots.value0,
    snapshots.value1
  );
}

export function handleTroveLiquidated(event: TroveLiquidated): void {
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
    getTroveOperationFromTroveManagerOperation(event.params._operation),
    event.params._borrower,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO,
    BIGINT_ZERO
  );
}

export function handleLiquidation(event: Liquidation): void {
  let troveManager = TroveManager.bind(event.address);

  finishCurrentLiquidation(
    event,
    event.params._liquidatedColl,
    event.params._liquidatedDebt,
    event.params._collGasCompensation,
    event.params._LUSDGasCompensation
  );

  updateTotalRedistributed(troveManager.L_ETH(), troveManager.L_LUSDDebt());
}

export function handleRedemption(event: Redemption): void {
  finishCurrentRedemption(
    event,
    event.params._attemptedLUSDAmount,
    event.params._actualLUSDAmount,
    event.params._ETHSent
  );
}
