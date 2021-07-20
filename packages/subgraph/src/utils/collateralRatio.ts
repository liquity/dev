import { BigDecimal } from "@graphprotocol/graph-ts";

import { DECIMAL_PRECISION, DECIMAL_ZERO } from "./bignumbers";

export function calculateCollateralRatio(
  collateral: BigDecimal,
  debt: BigDecimal,
  price: BigDecimal
): BigDecimal | null {
  if (debt == DECIMAL_ZERO) {
    return null;
  }

  return collateral.times(price).div(debt).truncate(DECIMAL_PRECISION);
}
