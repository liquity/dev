import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";

const milliseconds = (seconds: number) => seconds * 1000;

const toFloat = (decimal: Decimal, precision = null): number =>
  parseFloat(decimal.prettify(precision ?? 2));

const numberify = (bigNumber: BigNumber): number => bigNumber.toNumber();

const decimalify = (bigNumber: BigNumber): Decimal =>
  Decimal.fromBigNumberString(bigNumber.toHexString());

const secondsToDays = (seconds: number) => seconds / 60 / 60 / 24;

const daysToMilliseconds = (days: number) => days * 60 * 60 * 24 * 1000;

const getBondAgeInDays = (startTime: number): number =>
  secondsToDays((Date.now() - startTime) / 1000);

const dateWithoutHours = (timestamp: number) => new Date(new Date(timestamp).toDateString());

const getReturn = (accrued: Decimal, deposit: Decimal, marketPrice: Decimal): string => {
  const accruedLusdValue = accrued.mul(marketPrice);
  if (accruedLusdValue.lt(deposit)) {
    return (parseFloat(accruedLusdValue.toString()) - parseFloat(deposit.toString())).toFixed(2);
  }
  return accruedLusdValue.sub(deposit).prettify(2);
};

export {
  milliseconds,
  toFloat,
  numberify,
  decimalify,
  getBondAgeInDays,
  daysToMilliseconds,
  dateWithoutHours,
  getReturn
};
