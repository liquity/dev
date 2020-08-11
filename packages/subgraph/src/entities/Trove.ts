import { Bytes, Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { TroveChange } from "../../generated/schema";

import { getCurrentTroveOfOwner, closeCurrentTroveOfOwner } from "./Owner";

// E.g. 1.5 is represented as 1.5 * 10^18, where 10^18 is called the scaling factor
let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");
let BIGINT_SCALING_FACTOR = BigInt.fromI32(10).pow(18);

let ZERO = BigInt.fromI32(0);
let MAX_UINT256 = BigInt.fromUnsignedBytes(
  Bytes.fromHexString("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF") as Bytes
);

export function updateTrove(
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

  let troveChange = new TroveChange(txHash.toHex() + "-" + logIndex.toString());
  troveChange.trove = trove.id;
  troveChange.operation = operation;
  troveChange.save();

  trove.collateral = _coll.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.debt = _debt.divDecimal(DECIMAL_SCALING_FACTOR);

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
