import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";

const milliseconds = (seconds: number) => seconds * 1000;

const toInteger = (decimal: Decimal): number => parseInt(decimal.toString());

const numberify = (bigNumber: BigNumber): number => bigNumber.toNumber();

const decimalify = (bigNumber: BigNumber): Decimal =>
  Decimal.fromBigNumberString(bigNumber.toHexString());

const secondsToDays = (seconds: number) => seconds / 60 / 60 / 24;

const daysToMilliseconds = (days: number) => days * 60 * 60 * 24 * 1000;

const getBondAgeInDays = (startTimeInSeconds: number): number =>
  secondsToDays((Date.now() - milliseconds(startTimeInSeconds)) / 1000);

const dateWithoutHours = (timestamp: number) => new Date(new Date(timestamp).toDateString());

export {
  milliseconds,
  toInteger,
  numberify,
  decimalify,
  getBondAgeInDays,
  daysToMilliseconds,
  dateWithoutHours
};
