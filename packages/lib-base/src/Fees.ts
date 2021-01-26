import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

/**
 * Calculator for fees.
 *
 * @remarks
 * Returned by the {@link ReadableLiquity.getFees | getFees()} function.
 *
 * @public
 */
export class Fees {
  private readonly _baseRateWithoutDecay: Decimal;
  private readonly _minuteDecayFactor: Decimal;
  private readonly _beta: Decimal;
  private readonly _lastFeeOperation: Date;

  /** @internal */
  constructor(
    lastFeeOperation: Date,
    baseRateWithoutDecay: Decimalish,
    minuteDecayFactor: Decimalish,
    beta: Decimalish
  ) {
    this._lastFeeOperation = lastFeeOperation;
    this._baseRateWithoutDecay = Decimal.from(baseRateWithoutDecay);
    this._minuteDecayFactor = Decimal.from(minuteDecayFactor);
    this._beta = Decimal.from(beta);

    assert(this._minuteDecayFactor.lt(1));
  }

  /**
   * Compare to another instance of `Fees`.
   */
  equals(that: Fees): boolean {
    return (
      this._baseRateWithoutDecay.eq(that._baseRateWithoutDecay) &&
      this._minuteDecayFactor.eq(that._minuteDecayFactor) &&
      this._beta.eq(that._beta) &&
      this._lastFeeOperation.getTime() === that._lastFeeOperation.getTime()
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ baseRateWithoutDecay: ${this._baseRateWithoutDecay}` +
      `, lastFeeOperation: "${this._lastFeeOperation.toLocaleString()}" } `
    );
  }

  /** @internal */
  baseRate(when: Date): Decimal {
    const millisecondsSinceLastFeeOperation = Math.max(
      when.getTime() - this._lastFeeOperation.getTime(),
      0 // Clamp negative elapsed time to 0, in case the client's time is in the past.
      // We will calculate slightly higher than actual fees, which is fine.
    );

    const minutesSinceLastFeeOperation = Math.floor(millisecondsSinceLastFeeOperation / 60000);

    return this._minuteDecayFactor.pow(minutesSinceLastFeeOperation).mul(this._baseRateWithoutDecay);
  }

  /**
   * Calculate the current borrowing fee factor.
   *
   * @remarks
   * To calculate the borrowing fee in LUSD, multiply the borrowed LUSD amount with the borrowing
   * fee factor.
   *
   * @example
   * ```typescript
   * const fees = await liquity.getFees();
   *
   * const borrowedLUSDAmount = 100;
   * const borrowingFeeFactor = fees.borrowingFeeFactor();
   * const borrowingFeeLUSD = borrowingFeeFactor.mul(borrowedLUSDAmount);
   * ```
   */
  borrowingFeeFactor(): Decimal {
    return this.baseRate(new Date());
  }

  /**
   * Calculate the current redemption fee factor.
   *
   * @remarks
   * Unlike the borrowing fee factor, the redemption fee factor depends on the amount being redeemed.
   * To be more precise, it depends on the fraction of the redeemed amount compared to the total
   * LUSD supply, which must be passed as a parameter.
   *
   * To calculate the redemption fee in LUSD, multiply the redeemed LUSD amount with the redemption
   * fee factor.
   *
   * @example
   * ```typescript
   * const fees = await liquity.getFees();
   * const total = await liquity.getTotal();
   *
   * const redeemedLUSDAmount = Decimal.from(100);
   * const redeemedFractionOfSupply = redeemedLUSDAmount.div(total.debt);
   * const redemptionFeeFactor = fees.redemptionFeeFactor(redeemedFractionOfSupply);
   * const redemptionFeeLUSD = redemptionFeeFactor.mul(redeemedLUSDAmount);
   * ```
   *
   * @param redeemedFractionOfSupply - the amount of LUSD being redeemed divided by the total supply
   */
  redemptionFeeFactor(redeemedFractionOfSupply: Decimalish = Decimal.ZERO): Decimal {
    redeemedFractionOfSupply = Decimal.from(redeemedFractionOfSupply);
    let baseRate = this.baseRate(new Date());

    if (redeemedFractionOfSupply.nonZero) {
      baseRate = redeemedFractionOfSupply.div(this._beta).add(baseRate);
    }

    return baseRate.lt(Decimal.ONE) ? baseRate : Decimal.ONE;
  }
}
