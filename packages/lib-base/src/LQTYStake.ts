import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an LQTY Stake.
 *
 * @public
 */
export type LQTYStakeChange<T> =
  | { stakeLQTY: T; unstakeLQTY?: undefined }
  | { stakeLQTY?: undefined; unstakeLQTY: T; unstakeAllLQTY: boolean };

/** 
 * Represents a user's LQTY stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableLiquity.getLQTYStake | getLQTYStake()} function.

 * @public
 */
export class LQTYStake {
  /** The amount of LQTY that's staked. */
  readonly stakedLQTY: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** LUSD gain available to withdraw. */
  readonly lusdGain: Decimal;

  /** @internal */
  constructor(stakedLQTY = Decimal.ZERO, collateralGain = Decimal.ZERO, lusdGain = Decimal.ZERO) {
    this.stakedLQTY = stakedLQTY;
    this.collateralGain = collateralGain;
    this.lusdGain = lusdGain;
  }

  get isEmpty(): boolean {
    return this.stakedLQTY.isZero && this.collateralGain.isZero && this.lusdGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedLQTY: ${this.stakedLQTY}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lusdGain: ${this.lusdGain} }`
    );
  }

  /**
   * Compare to another instance of `LQTYStake`.
   */
  equals(that: LQTYStake): boolean {
    return (
      this.stakedLQTY.eq(that.stakedLQTY) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lusdGain.eq(that.lusdGain)
    );
  }

  /**
   * Calculate the difference between this `LQTYStake` and `thatStakedLQTY`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedLQTY: Decimalish): LQTYStakeChange<Decimal> | undefined {
    thatStakedLQTY = Decimal.from(thatStakedLQTY);

    if (thatStakedLQTY.lt(this.stakedLQTY)) {
      return {
        unstakeLQTY: this.stakedLQTY.sub(thatStakedLQTY),
        unstakeAllLQTY: thatStakedLQTY.isZero
      };
    }

    if (thatStakedLQTY.gt(this.stakedLQTY)) {
      return { stakeLQTY: thatStakedLQTY.sub(this.stakedLQTY) };
    }
  }

  /**
   * Apply a {@link LQTYStakeChange} to this `LQTYStake`.
   *
   * @returns The new staked LQTY amount.
   */
  apply(change: LQTYStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedLQTY;
    }

    if (change.unstakeLQTY !== undefined) {
      return change.unstakeAllLQTY || this.stakedLQTY.lte(change.unstakeLQTY)
        ? Decimal.ZERO
        : this.stakedLQTY.sub(change.unstakeLQTY);
    } else {
      return this.stakedLQTY.add(change.stakeLQTY);
    }
  }
}
