import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";

const milliseconds = (seconds: number) => seconds * 1000;

const toFloat = (decimal: Decimal): number => parseFloat(decimal.toString());

const numberify = (bigNumber: BigNumber): number => bigNumber.toNumber();

const decimalify = (bigNumber: BigNumber): Decimal =>
  Decimal.fromBigNumberString(bigNumber.toHexString());

const percentify = (fraction: number): number => fraction * 100;

const secondsToDays = (seconds: number): number => seconds / 60 / 60 / 24;

const daysToMilliseconds = (days: number): number => days * 60 * 60 * 24 * 1000;

const getBondAgeInDays = (startTime: number): number =>
  secondsToDays((Date.now() - startTime) / 1000);

const dateWithoutHours = (timestamp: number) => new Date(new Date(timestamp).toDateString());

// Decimal type doesn't support negatives so use number instead
const getReturn = (accrued: Decimal, deposit: Decimal, marketPrice: Decimal): number => {
  const accruedLusdValue = accrued.mul(marketPrice);
  return parseFloat(accruedLusdValue.toString()) - parseFloat(deposit.toString());
};

const getTokenUri = (encodedTokenUri: string): string => {
  // HACK/TODO: new goerli deployment has fixed data format issue, switch to it
  const dataStartIndex = encodedTokenUri.indexOf("base64,") + "base64,".length;
  if (dataStartIndex === -1) return "TODO:"; // TODO: should we render an error image?

  const hack = atob(encodedTokenUri.slice(dataStartIndex))
    .replace(`"background_color":`, `,"background_color":`) // Goerli fix
    .replace(",,", ","); // Rinkeby fix

  const tokenUri = JSON.parse(hack)?.image;
  return tokenUri;
};

const getBreakEvenDays = (
  alphaAccrualFactor: Decimal,
  marketPricePremium: Decimal,
  claimBondFee: Decimal
): Decimal => {
  const effectivePremium = marketPricePremium.mul(Decimal.ONE.sub(claimBondFee));
  if (effectivePremium.lte(Decimal.ONE)) return Decimal.INFINITY;
  return alphaAccrualFactor.div(effectivePremium.sub(Decimal.ONE));
};

const getFutureBLusdAccrualFactor = (
  floorPrice: Decimal,
  daysInFuture: Decimal,
  alphaAccrualFactor: Decimal,
  bondAgeInDays = Decimal.ZERO
): Decimal => {
  const duration = daysInFuture.sub(bondAgeInDays);
  return Decimal.ONE.div(floorPrice).mul(duration.div(duration.add(alphaAccrualFactor)));
};

const getRebondDays = (
  alphaAccrualFactor: Decimal,
  marketPricePremium: Decimal,
  claimBondFee: Decimal
): Decimal => {
  const effectivePremium = Decimal.ONE.sub(claimBondFee).mul(marketPricePremium);
  if (effectivePremium.lte(Decimal.ONE)) return Decimal.INFINITY;
  const sqrt = Decimal.from(Math.sqrt(parseFloat(effectivePremium.toString())));
  const dividend = Decimal.ONE.add(sqrt);
  const divisor = effectivePremium.sub(Decimal.ONE);
  return alphaAccrualFactor.mul(dividend.div(divisor));
};

const getFutureDateByDays = (days: number): Date => {
  return new Date(Math.round(Date.now() + daysToMilliseconds(days)));
};

export {
  milliseconds,
  toFloat,
  numberify,
  decimalify,
  percentify,
  getBondAgeInDays,
  daysToMilliseconds,
  dateWithoutHours,
  getReturn,
  getTokenUri,
  getFutureBLusdAccrualFactor,
  getBreakEvenDays,
  getRebondDays,
  getFutureDateByDays
};
