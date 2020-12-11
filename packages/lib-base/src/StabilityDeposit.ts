import { Decimal, Decimalish } from "@liquity/decimal";

// yeah, sounds stupid...
interface StabilityDepositish {
  readonly initial?: Decimalish;
  readonly current?: Decimalish;
  readonly collateralGain?: Decimalish;
  readonly lqtyReward?: Decimalish;
}

type StabilityDepositChange<T> =
  | { depositLUSD: T; withdrawLUSD?: undefined }
  | { depositLUSD?: undefined; withdrawLUSD: T; withdrawAllLUSD: boolean };

export class StabilityDeposit {
  readonly initial: Decimal;
  readonly current: Decimal;
  readonly collateralGain: Decimal;
  readonly lqtyReward: Decimal;

  constructor({
    initial = 0,
    current = initial,
    collateralGain = 0,
    lqtyReward = 0
  }: StabilityDepositish) {
    this.initial = Decimal.from(initial);
    this.current = Decimal.from(current);
    this.collateralGain = Decimal.from(collateralGain);
    this.lqtyReward = Decimal.from(lqtyReward);

    if (this.current.gt(this.initial)) {
      throw new Error("current can't be greater than initial");
    }
  }

  get isEmpty(): boolean {
    return this.initial.isZero && this.current.isZero && this.collateralGain.isZero;
  }

  toString(): string {
    return (
      `{ initial: ${this.initial}` +
      `, current: ${this.current}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lqtyReward: ${this.lqtyReward} }`
    );
  }

  equals(that: StabilityDeposit): boolean {
    return (
      this.initial.eq(that.initial) &&
      this.current.eq(that.current) &&
      this.collateralGain.eq(that.collateralGain)
    );
  }

  whatChanged(that: Decimalish): StabilityDepositChange<Decimal> | undefined {
    that = Decimal.from(that);

    if (that.lt(this.current)) {
      return { withdrawLUSD: this.current.sub(that), withdrawAllLUSD: that.isZero };
    }

    if (that.gt(this.current)) {
      return { depositLUSD: that.sub(this.current) };
    }
  }

  apply(change: StabilityDepositChange<Decimalish> | undefined): Decimal {
    if (!change) {
      return this.current;
    }

    if (change.withdrawLUSD !== undefined) {
      return change.withdrawAllLUSD || this.current.lte(change.withdrawLUSD)
        ? Decimal.ZERO
        : this.current.sub(change.withdrawLUSD);
    } else {
      return this.current.add(change.depositLUSD);
    }
  }
}
