import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositLUSD: T; withdrawLUSD?: undefined }
  | { depositLUSD?: undefined; withdrawLUSD: T; withdrawAllLUSD: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of LUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialLUSD: Decimal;

  /** Amount of LUSD left in the Stability Deposit. */
  readonly currentLUSD: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up LUSD. */
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
    initialLUSD: Decimal,
    currentLUSD: Decimal,
    collateralGain: Decimal,
    lqtyReward: Decimal,
    frontendTag: string
  ) {
    this.initialLUSD = initialLUSD;
    this.currentLUSD = currentLUSD;
    this.collateralGain = collateralGain;
    this.lqtyReward = lqtyReward;
    this.frontendTag = frontendTag;

    if (this.currentLUSD.gt(this.initialLUSD)) {
      throw new Error("currentLUSD can't be greater than initialLUSD");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialLUSD.isZero &&
      this.currentLUSD.isZero &&
      this.collateralGain.isZero &&
      this.lqtyReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialLUSD: ${this.initialLUSD}` +
      `, currentLUSD: ${this.currentLUSD}` +
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
      this.initialLUSD.eq(that.initialLUSD) &&
      this.currentLUSD.eq(that.currentLUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lqtyReward.eq(that.lqtyReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentLUSD` in this Stability Deposit and `thatLUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatLUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatLUSD = Decimal.from(thatLUSD);

    if (thatLUSD.lt(this.currentLUSD)) {
      return { withdrawLUSD: this.currentLUSD.sub(thatLUSD), withdrawAllLUSD: thatLUSD.isZero };
    }

    if (thatLUSD.gt(this.currentLUSD)) {
      return { depositLUSD: thatLUSD.sub(this.currentLUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited LUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentLUSD;
    }

    if (change.withdrawLUSD !== undefined) {
      return change.withdrawAllLUSD || this.currentLUSD.lte(change.withdrawLUSD)
        ? Decimal.ZERO
        : this.currentLUSD.sub(change.withdrawLUSD);
    } else {
      return this.currentLUSD.add(change.depositLUSD);
    }
  }
}
