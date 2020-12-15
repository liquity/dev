import { Decimal, Decimalish } from "@liquity/decimal";

// now, this is silly...
interface LQTYStakish {
  readonly stakedLQTY?: Decimalish;
  readonly collateralGain?: Decimalish;
  readonly lusdGain?: Decimalish;
}

type LQTYStakeChange<T> =
  | { stakeLQTY: T; unstakeLQTY?: undefined }
  | { stakeLQTY?: undefined; unstakeLQTY: T; unstakeAllLQTY: boolean };

export class LQTYStake {
  readonly stakedLQTY: Decimal;
  readonly collateralGain: Decimal;
  readonly lusdGain: Decimal;

  constructor({ stakedLQTY = 0, collateralGain = 0, lusdGain = 0 }: LQTYStakish) {
    this.stakedLQTY = Decimal.from(stakedLQTY);
    this.collateralGain = Decimal.from(collateralGain);
    this.lusdGain = Decimal.from(lusdGain);
  }

  get isEmpty(): boolean {
    return this.stakedLQTY.isZero && this.collateralGain.isZero && this.lusdGain.isZero;
  }

  toString(): string {
    return (
      `{ stakedLQTY: ${this.stakedLQTY}` +
      `, collateralGain: ${this.collateralGain}` +
      `, lusdGain: ${this.lusdGain} }`
    );
  }

  equals(that: LQTYStake): boolean {
    return (
      this.stakedLQTY.eq(that.stakedLQTY) &&
      this.collateralGain.eq(that.collateralGain) &&
      this.lusdGain.eq(that.lusdGain)
    );
  }

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
