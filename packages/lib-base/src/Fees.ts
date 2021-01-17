import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

export class Fees {
  private readonly baseRateWithoutDecay: Decimal;
  private readonly minuteDecayFactor: Decimal;
  private readonly lastFeeOperation: Date;

  constructor(
    lastFeeOperation: Date,
    baseRateWithoutDecay: Decimalish,
    minuteDecayFactor: Decimalish
  ) {
    this.lastFeeOperation = lastFeeOperation;
    this.baseRateWithoutDecay = Decimal.from(baseRateWithoutDecay);
    this.minuteDecayFactor = Decimal.from(minuteDecayFactor);

    assert(this.minuteDecayFactor.lt(1));
  }

  equals(that: Fees): boolean {
    return (
      this.baseRateWithoutDecay.eq(that.baseRateWithoutDecay) &&
      this.minuteDecayFactor.eq(that.minuteDecayFactor) &&
      this.lastFeeOperation.getTime() === that.lastFeeOperation.getTime()
    );
  }

  toString(): string {
    return (
      `{ baseRateWithoutDecay: ${this.baseRateWithoutDecay}` +
      `, lastFeeOperation: "${this.lastFeeOperation.toLocaleString()}" } `
    );
  }

  baseRate(when: Date): Decimal {
    const millisecondsSinceLastFeeOperation = Math.max(
      when.getTime() - this.lastFeeOperation.getTime(),
      0 // Clamp negative elapsed time to 0, in case the client's time is in the past.
      // We will calculate slightly higher than actual fees, which is fine.
    );

    const minutesSinceLastFeeOperation = Math.floor(millisecondsSinceLastFeeOperation / 60000);

    return this.minuteDecayFactor.pow(minutesSinceLastFeeOperation).mul(this.baseRateWithoutDecay);
  }

  borrowingFeeFactor(when = new Date()): Decimal {
    return this.baseRate(when);
  }

  redemptionFeeFactor(when = new Date()): Decimal {
    return this.baseRate(when);
  }

  optimisticRedemptionFee(
    grossRedeemedLUSD: Decimalish,
    totalLUSDSupply: Decimalish,
    when = new Date()
  ): Decimal {
    grossRedeemedLUSD = Decimal.from(grossRedeemedLUSD);
    totalLUSDSupply = Decimal.from(totalLUSDSupply);

    const numerator = this.baseRate(when)
      .mul(totalLUSDSupply)
      .add(grossRedeemedLUSD)
      .mul(grossRedeemedLUSD);

    const denominator = totalLUSDSupply.add(grossRedeemedLUSD);

    return numerator.div(denominator);
  }
}
