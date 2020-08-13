import { Bytes, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { createTroveChange } from "./System";
import { getCurrentTroveOfOwner, closeCurrentTroveOfOwner } from "./Owner";

// E.g. 1.5 is represented as 1.5 * 10^18, where 10^18 is called the scaling factor
let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");
let BIGINT_SCALING_FACTOR = BigInt.fromI32(10).pow(18);

let ZERO = BigInt.fromI32(0);
let MAX_UINT256 = BigInt.fromUnsignedBytes(
  Bytes.fromHexString("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF") as Bytes
);

export function updateTrove(
  timestamp: BigInt,
  txHash: Bytes,
  logIndex: BigInt,
  operation: string,
  _user: Address,
  _coll: BigInt,
  _debt: BigInt,
  stake: BigInt,
  snapshotETH: BigInt,
  snapshotCLVDebt: BigInt
): void {
  let trove = getCurrentTroveOfOwner(_user);

  let troveChange = createTroveChange(txHash.toHex() + "-" + logIndex.toString());
  troveChange.timestamp = timestamp.toI32();
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
