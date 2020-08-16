import { ethereum, Bytes, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { TroveChange } from "../../generated/schema";

import { getChangeId, initChange } from "./System";
import { getCurrentTroveOfOwner, closeCurrentTroveOfOwner } from "./Owner";

// E.g. 1.5 is represented as 1.5 * 10^18, where 10^18 is called the scaling factor
let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");
let BIGINT_SCALING_FACTOR = BigInt.fromI32(10).pow(18);

let ZERO = BigInt.fromI32(0);
let MAX_UINT256 = BigInt.fromUnsignedBytes(
  Bytes.fromHexString("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF") as Bytes
);

function createTroveChange(event: ethereum.Event): TroveChange {
  let troveChange = new TroveChange(getChangeId(event));
  initChange(troveChange, event);

  return troveChange;
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

  let troveChange = createTroveChange(event);
  troveChange.trove = trove.id;
  troveChange.operation = operation;

  troveChange.collateralBefore = trove.collateral;
  troveChange.debtBefore = trove.debt;

  trove.collateral = _coll.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.debt = _debt.divDecimal(DECIMAL_SCALING_FACTOR);

  troveChange.collateralAfter = trove.collateral;
  troveChange.collateralChange = troveChange.collateralAfter.minus(troveChange.collateralBefore);
  troveChange.debtAfter = trove.debt;
  troveChange.debtChange = troveChange.debtAfter.minus(troveChange.debtBefore);
  troveChange.save();

  trove.rawCollateral = _coll;
  trove.rawDebt = _debt;
  trove.rawStake = stake;
  trove.rawSnapshotOfTotalRedistributedCollateral = snapshotETH;
  trove.rawSnapshotOfTotalRedistributedDebt = snapshotCLVDebt;

  if (!_debt.equals(ZERO)) {
    trove.rawCollateralPerDebt = _coll.times(BIGINT_SCALING_FACTOR).div(_debt);
  } else {
    trove.rawCollateralPerDebt = MAX_UINT256;
  }

  if (_coll.equals(ZERO)) {
    closeCurrentTroveOfOwner(_user);
  }

  trove.save();
}
