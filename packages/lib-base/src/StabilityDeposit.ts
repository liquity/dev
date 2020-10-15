import { Decimal, Decimalish, Difference } from "@liquity/decimal";

// yeah, sounds stupid...
interface StabilityDepositish {
  readonly deposit?: Decimalish;
  readonly depositAfterLoss?: Decimalish;
  readonly pendingCollateralGain?: Decimalish;
}

export class StabilityDeposit {
  readonly deposit: Decimal;
  readonly depositAfterLoss: Decimal;
  readonly pendingCollateralGain: Decimal;

  get isEmpty(): boolean {
    return this.deposit.isZero && this.depositAfterLoss.isZero && this.pendingCollateralGain.isZero;
  }

  constructor({
    deposit = 0,
    depositAfterLoss = deposit,
    pendingCollateralGain = 0
  }: StabilityDepositish) {
    this.deposit = Decimal.from(deposit);
    this.depositAfterLoss = Decimal.from(depositAfterLoss);
    this.pendingCollateralGain = Decimal.from(pendingCollateralGain);
  }

  toString(): string {
    return (
      "{\n" +
      `  deposit: ${this.deposit},\n` +
      `  depositAfterLoss: ${this.depositAfterLoss},\n` +
      `  pendingCollateralGain: ${this.pendingCollateralGain}\n` +
      "}"
    );
  }

  equals(that: StabilityDeposit): boolean {
    return (
      this.deposit.eq(that.deposit) &&
      this.depositAfterLoss.eq(that.depositAfterLoss) &&
      this.pendingCollateralGain.eq(that.pendingCollateralGain)
    );
  }

  calculateDifference(that: StabilityDeposit): Difference | undefined {
    if (!that.depositAfterLoss.eq(this.depositAfterLoss)) {
      return Difference.between(that.depositAfterLoss, this.depositAfterLoss);
    }
  }

  apply(difference?: Difference): StabilityDeposit {
    if (difference?.positive) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return new StabilityDeposit({ deposit: this.depositAfterLoss.add(difference.absoluteValue!) });
    } else if (difference?.negative) {
      return new StabilityDeposit({
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        deposit: difference.absoluteValue!.lt(this.depositAfterLoss)
          ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.depositAfterLoss.sub(difference.absoluteValue!)
          : 0
      });
    } else {
      return this;
    }
  }
}
