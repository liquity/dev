import { ethereum, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { TroveChange } from "../../generated/schema";

import {
  BIGINT_SCALING_FACTOR,
  DECIMAL_SCALING_FACTOR,
  BIGINT_ZERO,
  BIGINT_MAX_UINT256,
  DECIMAL_ZERO
} from "../utils/bignumbers";

import { getChangeId, initChange, getCurrentPrice } from "./System";
import { getCurrentTroveOfOwner, closeCurrentTroveOfOwner } from "./Owner";

function createTroveChange(event: ethereum.Event): TroveChange {
  let troveChange = new TroveChange(getChangeId(event));
  initChange(troveChange, event);

  return troveChange;
}

function calculateCollateralRatio(
  collateral: BigDecimal,
  debt: BigDecimal,
  price: BigDecimal
): BigDecimal | null {
  if (debt.equals(DECIMAL_ZERO)) {
    return null;
  }

  return collateral.times(price).div(debt);
}

export function updateTrove(
  event: ethereum.Event,
  operation: string,
  _user: Address,
  _coll: BigInt,
  _debt: BigInt,
  stake: BigInt,
  snapshotETH: BigInt,
  snapshotCLVDebt: BigInt
): void {
  let trove = getCurrentTroveOfOwner(_user);
  let price = getCurrentPrice();
  let troveChange = createTroveChange(event);

  troveChange.trove = trove.id;
  troveChange.troveOperation = operation;
  troveChange.price = price;

  troveChange.collateralBefore = trove.collateral;
  troveChange.debtBefore = trove.debt;
  troveChange.collateralRatioBefore = calculateCollateralRatio(trove.collateral, trove.debt, price);

  trove.collateral = _coll.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.debt = _debt.divDecimal(DECIMAL_SCALING_FACTOR);

  troveChange.collateralAfter = trove.collateral;
  troveChange.debtAfter = trove.debt;
  troveChange.collateralRatioAfter = calculateCollateralRatio(trove.collateral, trove.debt, price);

  troveChange.collateralChange = troveChange.collateralAfter.minus(troveChange.collateralBefore);
  troveChange.debtChange = troveChange.debtAfter.minus(troveChange.debtBefore);

  troveChange.save();

  trove.rawCollateral = _coll;
  trove.rawDebt = _debt;
  trove.rawStake = stake;
  trove.rawSnapshotOfTotalRedistributedCollateral = snapshotETH;
  trove.rawSnapshotOfTotalRedistributedDebt = snapshotCLVDebt;

  if (!_debt.equals(BIGINT_ZERO)) {
    trove.rawCollateralPerDebt = _coll.times(BIGINT_SCALING_FACTOR).div(_debt);
  } else {
    trove.rawCollateralPerDebt = BIGINT_MAX_UINT256;
  }

  if (_coll.equals(BIGINT_ZERO)) {
    closeCurrentTroveOfOwner(_user);
  }

  trove.save();
}
