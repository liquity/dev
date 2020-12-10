import { Decimal, Decimalish, Difference } from "@liquity/decimal";

// yeah, sounds stupid...
interface StabilityDepositish {
  readonly initial?: Decimalish;
  readonly current?: Decimalish;
  readonly collateralGain?: Decimalish;
}

export class StabilityDeposit {
  readonly initial: Decimal;
  readonly current: Decimal;
  readonly collateralGain: Decimal;

  get isEmpty(): boolean {
    return this.initial.isZero && this.current.isZero && this.collateralGain.isZero;
  }

  constructor({ initial = 0, current = initial, collateralGain = 0 }: StabilityDepositish) {
    this.initial = Decimal.from(initial);
    this.current = Decimal.from(current);
    this.collateralGain = Decimal.from(collateralGain);

    if (this.current.gt(this.initial)) {
      throw new Error("current can't be greater than initial");
    }
  }

  toString(): string {
    return (
      `{ initial: ${this.initial}` +
      `, current: ${this.current}` +
      `, collateralGain: ${this.collateralGain} }`
    );
  }

  equals(that: StabilityDeposit): boolean {
    return (
      this.initial.eq(that.initial) &&
      this.current.eq(that.current) &&
      this.collateralGain.eq(that.collateralGain)
    );
  }

  calculateDifference(that: StabilityDeposit): Difference | undefined {
    if (!that.current.eq(this.current)) {
      return Difference.between(that.current, this.current);
    }
  }

  apply(difference?: Difference): StabilityDeposit {
    if (difference?.positive) {
      return new StabilityDeposit({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        initial: this.current.add(difference.absoluteValue!)
      });
    } else if (difference?.negative) {
      return new StabilityDeposit({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        initial: difference.absoluteValue!.lt(this.current)
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.current.sub(difference.absoluteValue!)
          : 0
      });
    } else {
      return this;
    }
  }
}
