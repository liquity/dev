import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { Trove } from "../../generated/schema";

let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");

export function updateTrove(
  _user: Address,
  _coll: BigInt,
  _debt: BigInt,
  stake: BigInt,
  snapshotETH: BigInt,
  snapshotCLVDebt: BigInt
): void {
  let id = _user.toHexString();
  let trove = Trove.load(id) || new Trove(id);

  trove.collateral = _coll.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.debt = _debt.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.stake = stake.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.snapshotOfTotalRedistributedCollateral = snapshotETH.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.snapshotOfTotalRedistributedDebt = snapshotCLVDebt.divDecimal(DECIMAL_SCALING_FACTOR);

  trove.save();
}
