import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

export class Fees {
  private readonly baseRateWithoutDecay: Decimal;
  private readonly minuteDecayFactor: Decimal;
  private readonly beta: Decimal;
  private readonly lastFeeOperation: Date;

  constructor(
    lastFeeOperation: Date,
    baseRateWithoutDecay: Decimalish,
    minuteDecayFactor: Decimalish,
    beta: Decimalish
  ) {
    this.lastFeeOperation = lastFeeOperation;
    this.baseRateWithoutDecay = Decimal.from(baseRateWithoutDecay);
    this.minuteDecayFactor = Decimal.from(minuteDecayFactor);
    this.beta = Decimal.from(beta);

    assert(this.minuteDecayFactor.lt(1));
  }

  equals(that: Fees): boolean {
    return (
      this.baseRateWithoutDecay.eq(that.baseRateWithoutDecay) &&
      this.minuteDecayFactor.eq(that.minuteDecayFactor) &&
      this.beta.eq(that.beta) &&
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

  redemptionFeeFactor(
    redeemedFractionOfSupply: Decimalish = Decimal.ZERO,
    when = new Date()
  ): Decimal {
    redeemedFractionOfSupply = Decimal.from(redeemedFractionOfSupply);
    let baseRate = this.baseRate(when);

    if (redeemedFractionOfSupply.nonZero) {
      baseRate = redeemedFractionOfSupply.div(this.beta).add(baseRate);
    }

    return baseRate.lt(Decimal.ONE) ? baseRate : Decimal.ONE;
  }
}
