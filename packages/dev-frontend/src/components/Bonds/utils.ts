import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";

const milliseconds = (seconds: number) => seconds * 1000;

const toFloat = (decimal: Decimal): number => parseFloat(decimal.toString());

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
  return parseFloat(accruedLusdValue.sub(deposit).toString()).toFixed(2);
};

const getTokenUri = (encodedTokenUri: string): string => {
  // HACK/TODO: new goerli deployment has fixed data format issue, switch to it
  const dataStartIndex = encodedTokenUri.indexOf("base64,") + "base64,".length;
  if (dataStartIndex === -1) return "TODO:"; // TODO: should we render an error image?

  const hack = atob(encodedTokenUri.slice(dataStartIndex)).replace(
    `"background_color":`,
    `,"background_color":`
  );

  const tokenUri = JSON.parse(hack)?.image;
  return tokenUri;
};

export {
  milliseconds,
  toFloat,
  numberify,
  decimalify,
  getBondAgeInDays,
  daysToMilliseconds,
  dateWithoutHours,
  getReturn,
  getTokenUri
};
