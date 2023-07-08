import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two states of an STBL Stake.
 *
 * @public
 */
export type STBLStakeChange<T> =
  | { stakeSTBL: T; unstakeSTBL?: undefined }
  | { stakeSTBL?: undefined; unstakeSTBL: T; unstakeAllSTBL: boolean };

/** 
 * Represents a user's STBL stake and accrued gains.
 * 
 * @remarks
 * Returned by the {@link ReadableLiquity.getSTBLStake | getSTBLStake()} function.

 * @public
 */
export class STBLStake {
  /** The amount of STBL that's staked. */
  readonly stakedSTBL: Decimal;

  /** Collateral gain available to withdraw. */
  readonly collateralGain: Decimal;

  /** XBRL gain available to withdraw. */
  readonly xbrlGain: Decimal;

  /** @internal */
  constructor(stakedSTBL = Decimal.ZERO, collateralGain = Decimal.ZERO, xbrlGain = Decimal.ZERO) {
    this.stakedSTBL = stakedSTBL;
    this.collateralGain = collateralGain;
    this.xbrlGain = xbrlGain;
  }

  get isEmpty(): boolean {
    return this.stakedSTBL.isZero && this.collateralGain.isZero && this.xbrlGain.isZero;
  }

  /** @internal */
  toString(): string {
    return (
      `{ stakedSTBL: ${this.stakedSTBL}` +
      `, collateralGain: ${this.collateralGain}` +
      `, xbrlGain: ${this.xbrlGain} }`
    );
  }

  /**
   * Compare to another instance of `STBLStake`.
   */
  equals(that: STBLStake): boolean {
    return (
      this.stakedSTBL.eq(that.stakedSTBL) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.xbrlGain.eq(that.xbrlGain)
    );
  }

  /**
   * Calculate the difference between this `STBLStake` and `thatStakedSTBL`.
   *
   * @returns An object representing the change, or `undefined` if the staked amounts are equal.
   */
  whatChanged(thatStakedSTBL: Decimalish): STBLStakeChange<Decimal> | undefined {
    thatStakedSTBL = Decimal.from(thatStakedSTBL);

    if (thatStakedSTBL.lt(this.stakedSTBL)) {
      return {
        unstakeSTBL: this.stakedSTBL.sub(thatStakedSTBL),
        unstakeAllSTBL: thatStakedSTBL.isZero
      };
    }

    if (thatStakedSTBL.gt(this.stakedSTBL)) {
      return { stakeSTBL: thatStakedSTBL.sub(this.stakedSTBL) };
    }
  }

  /**
   * Apply a {@link STBLStakeChange} to this `STBLStake`.
   *
   * @returns The new staked STBL amount.
   */
  apply(change: STBLStakeChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.stakedSTBL;
    }

    if (change.unstakeSTBL !== undefined) {
      return change.unstakeAllSTBL || this.stakedSTBL.lte(change.unstakeSTBL)
        ? Decimal.ZERO
        : this.stakedSTBL.sub(change.unstakeSTBL);
    } else {
      return this.stakedSTBL.add(change.stakeSTBL);
    }
  }
}
