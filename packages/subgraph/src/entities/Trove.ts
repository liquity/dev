import { Address, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

import { getCurrentTroveOfOwner, closeCurrentTroveOfOwner } from "./Owner";

let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");
let DECIMAL_ZERO = BigDecimal.fromString("0");

export function updateTrove(
  _user: Address,
  _coll: BigInt,
  _debt: BigInt,
  stake: BigInt,
  snapshotETH: BigInt,
  snapshotCLVDebt: BigInt
): void {
  let trove = getCurrentTroveOfOwner(_user);

  trove.collateral = _coll.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.debt = _debt.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.stake = stake.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.snapshotOfTotalRedistributedCollateral = snapshotETH.divDecimal(DECIMAL_SCALING_FACTOR);
  trove.snapshotOfTotalRedistributedDebt = snapshotCLVDebt.divDecimal(DECIMAL_SCALING_FACTOR);

  if (trove.collateral.equals(DECIMAL_ZERO)) {
    closeCurrentTroveOfOwner(_user);
  }

  trove.save();
}
