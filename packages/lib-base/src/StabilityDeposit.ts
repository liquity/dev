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

  get isEmpty() {
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

  toString() {
    return (
      "{\n" +
      `  deposit: ${this.deposit},\n` +
      `  depositAfterLoss: ${this.depositAfterLoss},\n` +
      `  pendingCollateralGain: ${this.pendingCollateralGain}\n` +
      "}"
    );
  }

  equals(that: StabilityDeposit) {
    return (
      this.deposit.eq(that.deposit) &&
      this.depositAfterLoss.eq(that.depositAfterLoss) &&
      this.pendingCollateralGain.eq(that.pendingCollateralGain)
    );
  }

  calculateDifference(that: StabilityDeposit) {
    if (!that.depositAfterLoss.eq(this.depositAfterLoss)) {
      return Difference.between(that.depositAfterLoss, this.depositAfterLoss);
    }
  }

  apply(difference?: Difference) {
    if (difference?.positive) {
      return new StabilityDeposit({ deposit: this.depositAfterLoss.add(difference.absoluteValue!) });
    } else if (difference?.negative) {
      return new StabilityDeposit({
        deposit: difference.absoluteValue!.lt(this.depositAfterLoss)
          ? this.depositAfterLoss.sub(difference.absoluteValue!)
          : 0
      });
    } else {
      return this;
    }
  }
}
