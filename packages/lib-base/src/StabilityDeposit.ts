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
  /** pool share of user in the BAMM wich has a share in the stability pool */
  readonly bammPoolShare: Decimal;

  /** pool share of user in the BAMM wich has a share in the stability pool */
  readonly poolShare: Decimal;

  /** Amount of LUSD in the Stability Deposit at the time of the last direct modification. */
  readonly initialLUSD: Decimal;

  /** Amount of LUSD left in the Stability Deposit. */
  readonly currentLUSD: Decimal;

  /** Amount of USD left in the Stability Deposit. */
  readonly currentUSD: Decimal;

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

  readonly totalEthInBamm: Decimal;
  
  readonly totalLusdInBamm: Decimal;

  /** @internal */
  constructor(
    bammPoolShare: Decimal,
    poolShare: Decimal,
    initialLUSD: Decimal,
    currentUSD: Decimal,
    currentLUSD: Decimal,
    collateralGain: Decimal,
    lqtyReward: Decimal,
    frontendTag: string, 
    totalEthInBamm: Decimal,
    totalLusdInBamm: Decimal
  ) {
    this.bammPoolShare = bammPoolShare;
    this.poolShare = poolShare;
    this.initialLUSD = initialLUSD;
    this.currentUSD = currentUSD;
    this.currentLUSD = currentLUSD;
    this.collateralGain = collateralGain;
    this.lqtyReward = lqtyReward;
    this.frontendTag = frontendTag;
    this.totalEthInBamm = totalEthInBamm;
    this.totalLusdInBamm = totalLusdInBamm;
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
      `{ bammPoolShare: ${this.bammPoolShare}` +
      `, poolShare: ${this.poolShare}` +
      `, initialLUSD: ${this.initialLUSD}` +
      `, currentLUSD: ${this.currentLUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lqtyReward: ${this.lqtyReward}` +
      `, totalEthInBamm: ${this.totalEthInBamm}` +
      `, lqtyReward: ${this.lqtyReward}` +
      `, totalLusdInBamm: ${this.totalLusdInBamm}` +
      `, frontendTag: "${this.frontendTag}" }`
    );
  }

  /**
   * Compare to another instance of `StabilityDeposit`.
   */
  equals(that: StabilityDeposit): boolean {

    return (
      this.bammPoolShare.eq(that.bammPoolShare) &&
      this.poolShare.eq(that.poolShare) &&
      this.currentUSD.eq(that.currentUSD) &&
      this.initialLUSD.eq(that.initialLUSD) &&
      this.currentLUSD.eq(that.currentLUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lqtyReward.eq(that.lqtyReward) &&
      this.frontendTag === that.frontendTag &&
      this.totalEthInBamm === that.totalEthInBamm &&
      this.totalLusdInBamm === that.totalLusdInBamm
    );
  }

  /**
   * Calculate the difference between the `currentLUSD` in this Stability Deposit and `thatLUSD`.
   *
   * @returns An object representing the change, or `undefined` if the deposited amounts are equal.
   */
  whatChanged(thatUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatUSD = Decimal.from(thatUSD);

    if (thatUSD.lt(this.currentUSD)) {
      return { withdrawLUSD: this.currentUSD.sub(thatUSD), withdrawAllLUSD: thatUSD.isZero };
    }

    if (thatUSD.gt(this.currentUSD)) {
      return { depositLUSD: thatUSD.sub(this.currentUSD) };
    }
  }

  /**
   * Apply a {@link StabilityDepositChange} to this Stability Deposit.
   *
   * @returns The new deposited LUSD amount.
   */
  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.currentUSD;
    }

    if (change.withdrawLUSD !== undefined) {
      return change.withdrawAllLUSD || this.currentUSD.lte(change.withdrawLUSD)
        ? Decimal.ZERO
        : this.currentUSD.sub(change.withdrawLUSD);
    } else {
      return this.currentUSD.add(change.depositLUSD);
    }
  }
}
