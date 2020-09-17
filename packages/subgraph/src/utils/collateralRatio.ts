import { BigDecimal } from "@graphprotocol/graph-ts";

import { DECIMAL_ZERO } from "./bignumbers";

export function calculateCollateralRatio(
  collateral: BigDecimal,
  debt: BigDecimal,
  price: BigDecimal
): BigDecimal | null {
  if (debt == DECIMAL_ZERO) {
    return null;
  }

  return (collateral * price) / debt;
}
