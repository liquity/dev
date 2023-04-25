import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { deposit1USD: T; withdraw1USD?: undefined }
  | { deposit1USD?: undefined; withdraw1USD: T; withdrawAll1USD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of 1USD in the Stability Deposit at the time of the last direct modification. */
  readonly initial1USD: Decimal;

  /** Amount of 1USD left in the Stability Deposit. */
  readonly current1USD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up 1USD. */
  readonly collateralGain: Decimal;

  /** Amount of LQTY rewarded since the last modification of the Stability Deposit. */
  readonly lqtyReward: Decimal;

  /**
   * Address of frontend through which this Stability Deposit was made.
   *
   * @remarks
   * If the Stability Deposit was made through a frontend that doesn't tag deposits, this will be
   * the zero-address.
   */
  readonly frontendTag: string;

  /** @internal */
  constructor(
    initial1USD: Decimal,
    current1USD: Decimal,
    collateralGain: Decimal,
    lqtyReward: Decimal,
    frontendTag: string
  ) {
    this.initial1USD = initial1USD;
    this.current1USD = current1USD;
    this.collateralGain = collateralGain;
    this.lqtyReward = lqtyReward;
    this.frontendTag = frontendTag;

    if (this.current1USD.gt(this.initial1USD)) {
      throw new Error("current1USD can't be greater than initial1USD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initial1USD.isZero &&
      this.current1USD.isZero &&
      this.collateralGain.isZero &&
      this.lqtyReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initial1USD: ${this.initial1USD}` +
      `, current1USD: ${this.current1USD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lqtyReward: ${this.lqtyReward}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initial1USD.eq(that.initial1USD) &&
      this.current1USD.eq(that.current1USD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lqtyReward.eq(that.lqtyReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `current1USD` in this Stability Deposit and `that1USD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(that1USD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    that1USD = Decimal.from(that1USD);

    if (that1USD.lt(this.current1USD)) {
      return { withdraw1USD: this.current1USD.sub(that1USD), withdrawAll1USD: that1USD.isZero };
    }

    if (that1USD.gt(this.current1USD)) {
      return { deposit1USD: that1USD.sub(this.current1USD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited 1USD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.current1USD;
    }

    if (change.withdraw1USD !== undefined) {
      return change.withdrawAll1USD || this.current1USD.lte(change.withdraw1USD)
        ? Decimal.ZERO
        : this.current1USD.sub(change.withdraw1USD);
    } else {
      return this.current1USD.add(change.deposit1USD);
    }
  }
}
