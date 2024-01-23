import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";
import { lambertW0 } from "lambert-w-function";

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

const dummyTokenUri =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3NTAgMTA1MCI+PHN0eWxlPiNjYi1lZ2ctNTUgLmNiLWVnZyBwYXRoIHthbmltYXRpb246IHNoYWtlIDNzIGluZmluaXRlIGVhc2Utb3V0O3RyYW5zZm9ybS1vcmlnaW46IDUwJTt9QGtleWZyYW1lcyBzaGFrZSB7MCUgeyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfTY1JSB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9NzAlIHsgdHJhbnNmb3JtOiByb3RhdGUoM2RlZyk7IH03NSUgeyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfTgwJSB7IHRyYW5zZm9ybTogcm90YXRlKC0zZGVnKTsgfTg1JSB7IHRyYW5zZm9ybTogcm90YXRlKDBkZWcpOyB9OTAlIHsgdHJhbnNmb3JtOiByb3RhdGUoM2RlZyk7IH0xMDAlIHsgdHJhbnNmb3JtOiByb3RhdGUoMGRlZyk7IH19PC9zdHlsZT48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNiLWVnZy01NS1jYXJkLWRpYWdvbmFsLWdyYWRpZW50IiB5MT0iMTAwJSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPjxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2ZmZDIwMCIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI2ZmMDA4NyIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxnIGlkPSJjYi1lZ2ctNTUiPjxyZWN0IGZpbGw9IiNjZDdmMzIiIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIHJ4PSIzNy41Ii8+PHJlY3Qgc3R5bGU9ImZpbGw6IHVybCgjY2ItZWdnLTU1LWNhcmQtZGlhZ29uYWwtZ3JhZGllbnQpIiB4PSIzMCIgeT0iMzAiIHdpZHRoPSI2OTAiIGhlaWdodD0iOTkwIiByeD0iMzcuNSIvPjxlbGxpcHNlIGZpbGw9IiMwYTEwMmUiIGN4PSIzNzUiIGN5PSI1NjAuMjUiIHJ4PSI2MCIgcnk9IjExLjQiIC8+PGcgY2xhc3M9ImNiLWVnZyI+PHBhdGggZmlsbD0iI2NkN2YzMiIgZD0iTTI5My44NiA0NzguMTJjMCA0NS4zNiAzNi40IDgyLjEzIDgxLjI5IDgyLjEzczgxLjI5LTM2Ljc3IDgxLjI5LTgyLjEzUzQyMC4wNSAzNjUuODUgMzc1LjE1IDM2NS44NUMzMzIuNzQgMzY1Ljg1IDI5My44NiA0MzIuNzYgMjkzLjg2IDQ3OC4xMloiLz48cGF0aCBzdHlsZT0ibWl4LWJsZW5kLW1vZGU6IHNvZnQtbGlnaHQiIGZpbGw9IiNmZmYiIGQ9Ik0zMjguOTYgNDA5LjRjLTYgMTMuNTktNS40OCAyOS41MyAzLjI1IDM2LjExIDkuNzYgNy4zNSAyMy44OSA5IDM2Ljk4LTMuMTMgMTIuNTctMTEuNjYgMjMuNDgtNDMuOTQgMS4yNC01NS41QzM1OC4yNSAzODAuNTUgMzM1LjU5IDM5NC4zNSAzMjguOTYgNDA5LjRaIi8+PHBhdGggc3R5bGU9Im1peC1ibGVuZC1tb2RlOiBzb2Z0LWxpZ2h0IiBmaWxsPSIjMDAwIiBkPSJNNDE2LjE3IDM4NS4wMmMxMS45NCAyMC45MiAxOS4xNSA0NS4zNSAxOS4xNCA2NS41MiAwIDQ1LjM2LTM2LjQgODIuMTMtODEuMyA4Mi4xM2E4MC40NSA4MC40NSAwIDAgMS01Mi41Mi0xOS40NUMzMTQuNTIgNTQxLjAzIDM0Mi41NCA1NjAuMjcgMzc1IDU2MC4yN2M0NC45IDAgODEuMy0zNi43NyA4MS4zLTgyLjEzQzQ1Ni4zMSA0NDcuOTUgNDQwLjE4IDQwOC4yMiA0MTYuMTcgMzg1LjAyWiIvPjwvZz48dGV4dCBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2ssIEFyaWFsIiBmb250LXNpemU9IjcycHgiIGZvbnQtd2VpZ2h0PSI4MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjUwJSIgeT0iMTQlIj5MVVNEPC90ZXh0Pjx0ZXh0IGZpbGw9IiNmZmYiIGZvbnQtZmFtaWx5PSJBcmlhbCBCbGFjaywgQXJpYWwiIGZvbnQtc2l6ZT0iMzBweCIgZm9udC13ZWlnaHQ9IjgwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iNTAlIiB5PSIxOSUiPklEOiA1NTwvdGV4dD48dGV4dCBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2ssIEFyaWFsIiBmb250LXNpemU9IjQwcHgiIGZvbnQtd2VpZ2h0PSI4MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjUwJSIgeT0iNzIlIj5CT05EIEFNT1VOVDwvdGV4dD48dGV4dCBmaWxsPSIjZmZmIiBmb250LWZhbWlseT0iQXJpYWwgQmxhY2ssIEFyaWFsIiBmb250LXNpemU9IjY0cHgiIGZvbnQtd2VpZ2h0PSI4MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjUwJSIgeT0iODElIj40MDI8L3RleHQ+PHRleHQgZmlsbD0iI2ZmZiIgZm9udC1mYW1pbHk9IkFyaWFsIEJsYWNrLCBBcmlhbCIgZm9udC1zaXplPSIzMHB4IiBmb250LXdlaWdodD0iODAwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiB4PSI1MCUiIHk9IjkxJSIgb3BhY2l0eT0iMC42Ij5TRVBURU1CRVIgNywgMjAyMjwvdGV4dD48L2c+PC9zdmc+";
const getTokenUri = (encodedTokenUri: string): string => {
  // HACK: new goerli deployment has fixed data format issue, switch to it
  const dataStartIndex = encodedTokenUri.indexOf("base64,") + "base64,".length;

  const hack = atob(encodedTokenUri.slice(dataStartIndex))
    .replace(`"background_color":`, `,"background_color":`) // Goerli fix
    .replace(",,", ","); // Rinkeby fix

  const tokenUri = hack ? JSON.parse(hack)?.image : dummyTokenUri; // for localhost testing
  return tokenUri;
};

const getBreakEvenPeriodInDays = (
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

const getRebondPeriodInDays = (
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

const getFutureDateInDays = (days: number): Date => {
  return new Date(Math.round(Date.now() + daysToMilliseconds(days)));
};

const getFloorPrice = (
  bammLusdDebt: Decimal,
  totalLusdInCurve: Decimal,
  pendingLusd: Decimal,
  permanentLusd: Decimal,
  bLusdSupply: Decimal
): Decimal => {
  return bammLusdDebt.add(totalLusdInCurve).sub(pendingLusd).sub(permanentLusd).div(bLusdSupply);
};

const getAverageBondAgeInSeconds = (
  totalWeightedStartTimes: Decimal,
  pendingBucketLusd: Decimal
): Decimal => {
  const averageStartTimeMs =
    Math.round(parseFloat(totalWeightedStartTimes.div(pendingBucketLusd).toString())) * 1000;
  const averageBondAgeInSeconds = Decimal.from(Date.now() - averageStartTimeMs).div(1000);

  return averageBondAgeInSeconds;
};

const getDaysUntilControllerStartsAdjusting = (
  averageBondAgeInSeconds: Decimal,
  targetBondAgeInSeconds: Decimal
): Decimal => {
  const secondsUntil = targetBondAgeInSeconds.gt(averageBondAgeInSeconds)
    ? targetBondAgeInSeconds.sub(averageBondAgeInSeconds)
    : Decimal.ZERO;
  const daysUntil = secondsToDays(parseFloat(secondsUntil.toString()));
  return Decimal.from(daysUntil);
};

/*
  Given the current rebond/break-even period, work out how many days
  until the bond age will meet the reduced rebond/break-even period

  Formula:
     bondAge + max((averageBondAge - targetBondAge), 0) + k = 0.99^k * rebondOrBreakEvenPeriod
    (0.99 because the controller reduces alpha by 1% per day)
  
  Solved for k =
    -(W(-(ln(0.99)x / 0.99^(bondAge + max((averageBondAge - targetBondAge), 0))) + ln(0.99) * (bondAge + max((averageBondAge - targetBondAge), 0))) / ln(0.99)
  Where:
    k = days until bond meets the reduced rebond/break-even period
    W = lambert W function
*/
const getRemainingRebondOrBreakEvenDays = (
  bondAgeInSeconds: Decimal,
  targetBondAgeInSeconds: Decimal,
  averageBondAgeInSeconds: Decimal,
  rebondOrBreakEvenPeriodInDays: Decimal
): number => {
  const bondAgeInDays = secondsToDays(toFloat(bondAgeInSeconds));
  const daysUntilControllerStartsAdjusting = toFloat(
    getDaysUntilControllerStartsAdjusting(averageBondAgeInSeconds, targetBondAgeInSeconds)
  );
  const rebondOrBreakEvenDaysRemaining = toFloat(rebondOrBreakEvenPeriodInDays) - bondAgeInDays;

  if (rebondOrBreakEvenDaysRemaining < daysUntilControllerStartsAdjusting) {
    return rebondOrBreakEvenDaysRemaining;
  }

  const lambertDividend = Math.log(0.99) * toFloat(rebondOrBreakEvenPeriodInDays);
  const lambertDivisor = 0.99 ** (bondAgeInDays + daysUntilControllerStartsAdjusting);
  const lambertQuotient = lambertW0(-(lambertDividend / lambertDivisor));

  const formulaDividend =
    lambertQuotient + Math.log(0.99) * (bondAgeInDays + daysUntilControllerStartsAdjusting);

  const formulaDivisor = Math.log(0.99);

  const daysUntilBondReachesRebondOrBreakEven = -(formulaDividend / formulaDivisor);

  return daysUntilBondReachesRebondOrBreakEven;
};

const getRebondOrBreakEvenTimeWithControllerAdjustment = (
  bondAgeInSeconds: Decimal,
  targetBondAgeInSeconds: Decimal,
  averageBondAgeInSeconds: Decimal,
  rebondOrBreakEvenPeriodInDays: Decimal
): Date => {
  const daysUntilBondReachesRebondOrBreakEven = getRemainingRebondOrBreakEvenDays(
    bondAgeInSeconds,
    targetBondAgeInSeconds,
    averageBondAgeInSeconds,
    rebondOrBreakEvenPeriodInDays
  );

  return getFutureDateInDays(daysUntilBondReachesRebondOrBreakEven);
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
  getBreakEvenPeriodInDays,
  getRebondPeriodInDays,
  getAverageBondAgeInSeconds,
  getRemainingRebondOrBreakEvenDays,
  getRebondOrBreakEvenTimeWithControllerAdjustment,
  getFloorPrice
};
