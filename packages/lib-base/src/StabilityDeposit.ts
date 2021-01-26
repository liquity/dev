import { Decimal, Decimalish } from "@liquity/decimal";

export type StabilityDepositChange<T> =
  | { depositLUSD: T; withdrawLUSD?: undefined }
  | { depositLUSD?: undefined; withdrawLUSD: T; withdrawAllLUSD: boolean };

export class StabilityDeposit {
  readonly initialLUSD: Decimal;
  readonly currentLUSD: Decimal;
  readonly collateralGain: Decimal;
  readonly lqtyReward: Decimal;

  /** @internal */
  constructor(
    initialLUSD = Decimal.ZERO,
    currentLUSD = initialLUSD,
    collateralGain = Decimal.ZERO,
    lqtyReward = Decimal.ZERO
  ) {
    this.initialLUSD = initialLUSD;
    this.currentLUSD = currentLUSD;
    this.collateralGain = collateralGain;
    this.lqtyReward = lqtyReward;

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

  toString(): string {
    return (
      `{ initialLUSD: ${this.initialLUSD}` +
      `, currentLUSD: ${this.currentLUSD}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lqtyReward: ${this.lqtyReward} }`
    );
  }

  equals(that: StabilityDeposit): boolean {
    return (
      this.initialLUSD.eq(that.initialLUSD) &&
      this.currentLUSD.eq(that.currentLUSD) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lqtyReward.eq(that.lqtyReward)
    );
  }

  whatChanged(thatLUSD: Decimalish): StabilityDepositChange<Decimal> | undefined {
    thatLUSD = Decimal.from(thatLUSD);

    if (thatLUSD.lt(this.currentLUSD)) {
      return { withdrawLUSD: this.currentLUSD.sub(thatLUSD), withdrawAllLUSD: thatLUSD.isZero };
    }

    if (thatLUSD.gt(this.currentLUSD)) {
      return { depositLUSD: thatLUSD.sub(this.currentLUSD) };
    }
  }

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
