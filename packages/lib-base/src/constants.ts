import { Decimal } from "@liquity/decimal";

/**
 * Total collateral ratio below which recovery mode is triggered.
 *
 * @public
 */
export const CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);

/**
 * Collateral ratio below which a Trove can be liquidated in normal mode.
 *
 * @public
 */
export const MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);

/**
 * Amount of LUSD that's reserved for compensating the liquidator of a Trove.
 *
 * @public
 */
export const LUSD_LIQUIDATION_RESERVE: Decimal = Decimal.from(10);
