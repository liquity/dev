import { Bytes, BigInt, BigDecimal } from "@graphprotocol/graph-ts";

export let DECIMAL_PRECISION = 18;

// E.g. 1.5 is represented as 1.5 * 10^18, where 10^18 is called the scaling factor
export let DECIMAL_SCALING_FACTOR = BigDecimal.fromString("1000000000000000000");
export let BIGINT_SCALING_FACTOR = BigInt.fromI32(10).pow(18);

export let DECIMAL_ZERO = BigDecimal.fromString("0");
export let DECIMAL_ONE = BigDecimal.fromString("1");

export let DECIMAL_COLLATERAL_GAS_COMPENSATION_DIVISOR = BigDecimal.fromString("200");

export let BIGINT_ZERO = BigInt.fromI32(0);
export let BIGINT_MAX_UINT256 = BigInt.fromUnsignedBytes(
  Bytes.fromHexString("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF") as Bytes
);

export function decimalize(bigInt: BigInt): BigDecimal {
  return bigInt.divDecimal(DECIMAL_SCALING_FACTOR);
}
