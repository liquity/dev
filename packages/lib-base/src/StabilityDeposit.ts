import { Decimal, Decimalish } from "./Decimal";

/**
 * Represents the change between two Stability Deposit states.
 *
 * @public
 */
export type StabilityDepositChange<T> =
  | { depositXBRL: T; withdrawXBRL?: undefined }
  | { depositXBRL?: undefined; withdrawXBRL: T; withdrawAllXBRL: boolean };

/**
 * A Stability Deposit and its accrued gains.
 *
 * @public
 */
export class StabilityDeposit {
  /** Amount of XBRL in the Stability Deposit at the time of the last direct modification. */
  readonly initialXBRL: Decimal;

  /** Amount of XBRL left in the Stability Deposit. */
  readonly currentXBRL: Decimal;

  /** Amount of native currency (e.g. Ether) received in exchange for the used-up XBRL. */
  readonly collateralGain: Decimal;

  /** Amount of STBL rewarded since the last modification of the Stability Deposit. */
  readonly stblReward: Decimal;

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
    initialXBRL: Decimal,
    currentXBRL: Decimal,
    collateralGain: Decimal,
    stblReward: Decimal,
    frontendTag: string
  ) {
    this.initialXBRL = initialXBRL;
    this.currentXBRL = currentXBRL;
    this.collateralGain = collateralGain;
    this.stblReward = stblReward;
    this.frontendTag = frontendTag;

    if (this.currentXBRL.gt(this.initialXBRL)) {
      throw new Error("currentXBRL can't be greater than initialXBRL");
    }
  }

  get isEmpty(): boolean {
    return (
      this.initialXBRL.isZero &&
      this.currentXBRL.isZero &&
      this.collateralGain.isZero &&
      this.stblReward.isZero
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ initialXBRL: ${this.initialXBRL}` +
      `, currentXBRL: ${this.currentXBRL}` +
      `, collateralGain: ${this.collateralGain}` +
      `, stblReward: ${this.stblReward}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {
    return (
      this.initialXBRL.eq(that.initialXBRL) &&
      this.currentXBRL.eq(that.currentXBRL) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.stblReward.eq(that.stblReward) &&
      this.frontendTag === that.frontendTag
    );
  }

  /**
   * Calculate the difference between the `currentXBRL` in this Stability Deposit and `thatXBRL`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatXBRL: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatXBRL = Decimal.from(thatXBRL);

    if (thatXBRL.lt(this.currentXBRL)) {
      return { withdrawXBRL: this.currentXBRL.sub(thatXBRL), withdrawAllXBRL: thatXBRL.isZero };
    }

    if (thatXBRL.gt(this.currentXBRL)) {
      return { depositXBRL: thatXBRL.sub(this.currentXBRL) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited XBRL amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentXBRL;
    }

    if (change.withdrawXBRL !== undefined) {
      return change.withdrawAllXBRL || this.currentXBRL.lte(change.withdrawXBRL)
        ? Decimal.ZERO
        : this.currentXBRL.sub(change.withdrawXBRL);
    } else {
      return this.currentXBRL.add(change.depositXBRL);
    }
  }
}
