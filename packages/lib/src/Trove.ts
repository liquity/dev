import { Decimal, Decimalish, Difference } from "@liquity/decimal";

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
  readonly virtualDebt?: Decimalish;
}

export type TroveChange = {
  collateralDifference?: Difference;
  debtDifference?: Difference;
};

export class Trove {
  public static readonly CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);
  public static readonly MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);
  // public static readonly DEFAULT_VIRTUAL_DEBT: Decimal = Decimal.from(10);
  public static readonly DEFAULT_VIRTUAL_DEBT: Decimal = Decimal.from(0);

  readonly collateral: Decimal;
  readonly debt: Decimal;

  /**
   * Imaginary debt that doesn't need to be repaid, but counts towards collateral ratio (lowers it).
   *
   * When performing arithmetic on Troves (addition or subtraction of 2 Troves, multiplication by a
   * scalar), the virtual debt of the Trove on the left side of the operation will be copied to the
   * resulting Trove.
   */
  readonly virtualDebt: Decimal;

  constructor({ collateral = 0, debt = 0, virtualDebt = Trove.DEFAULT_VIRTUAL_DEBT }: Trovish = {}) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
    this.virtualDebt = Decimal.from(virtualDebt);
  }

  get isEmpty() {
    return this.collateral.isZero && this.debt.isZero;
  }

  get compositeDebt() {
    return this.debt.nonZero?.add(this.virtualDebt) ?? this.debt;
  }

  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.compositeDebt);
  }

  collateralRatioIsBelowMinimum(price: Decimalish) {
    return this.collateralRatio(price).lt(Trove.MINIMUM_COLLATERAL_RATIO);
  }

  collateralRatioIsBelowCritical(price: Decimalish) {
    return this.collateralRatio(price).lt(Trove.CRITICAL_COLLATERAL_RATIO);
  }

  toString() {
    return (
      `{ collateral: ${this.collateral}` +
      `, debt: ${this.debt}` +
      (this.collateral.nonZero && this.virtualDebt.nonZero
        ? `, virtualDebt: ${this.virtualDebt}`
        : "") +
      " }"
    );
  }

  equals(that: Trove) {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add({ collateral = 0, debt = 0 }: Trovish) {
    return new Trove({
      collateral: this.collateral.add(collateral),
      debt: this.debt.add(debt),
      virtualDebt: this.virtualDebt
    });
  }

  addCollateral(collateral: Decimalish) {
    return this.add({ collateral });
  }

  addDebt(debt: Decimalish) {
    return this.add({ debt });
  }

  subtract({ collateral = 0, debt = 0 }: Trovish) {
    return new Trove({
      collateral: this.collateral.sub(collateral),
      debt: this.debt.sub(debt),
      virtualDebt: this.virtualDebt
    });
  }

  subtractCollateral(collateral: Decimalish) {
    return this.subtract({ collateral });
  }

  subtractDebt(debt: Decimalish) {
    return this.subtract({ debt });
  }

  multiply(multiplier: Decimalish) {
    return new Trove({
      collateral: this.collateral.mul(multiplier),
      debt: this.debt.mul(multiplier),
      virtualDebt: this.virtualDebt
    });
  }

  setCollateral(collateral: Decimalish) {
    return new Trove({
      collateral,
      debt: this.debt,
      virtualDebt: this.virtualDebt
    });
  }

  setDebt(debt: Decimalish) {
    return new Trove({
      collateral: this.collateral,
      debt,
      virtualDebt: this.virtualDebt
    });
  }

  whatChanged({ collateral, debt }: Trove) {
    const change: TroveChange = {};

    if (!collateral.eq(this.collateral)) {
      change.collateralDifference = Difference.between(collateral, this.collateral);
    }

    if (!debt.eq(this.debt)) {
      change.debtDifference = Difference.between(debt, this.debt);
    }

    return change;
  }

  applyCollateralDifference(collateralDifference?: Difference) {
    if (collateralDifference?.positive) {
      return this.addCollateral(collateralDifference.absoluteValue!);
    } else if (collateralDifference?.negative) {
      if (collateralDifference.absoluteValue!.lt(this.collateral)) {
        return this.subtractCollateral(collateralDifference.absoluteValue!);
      } else {
        return this.setCollateral(0);
      }
    } else {
      return this;
    }
  }

  applyDebtDifference(debtDifference?: Difference) {
    if (debtDifference?.positive) {
      return this.addDebt(debtDifference.absoluteValue!);
    } else if (debtDifference?.negative) {
      if (debtDifference.absoluteValue!.lt(this.collateral)) {
        return this.subtractDebt(debtDifference.absoluteValue!);
      } else {
        return this.setDebt(0);
      }
    } else {
      return this;
    }
  }

  apply({ collateralDifference, debtDifference }: TroveChange) {
    return this.applyCollateralDifference(collateralDifference).applyDebtDifference(debtDifference);
  }
}

interface TrovishWithPendingRewards extends Trovish {
  readonly stake?: Decimalish;
  readonly snapshotOfTotalRedistributed?: Trovish;
}

export class TroveWithPendingRewards extends Trove {
  readonly stake: Decimal;
  readonly snapshotOfTotalRedistributed: Trove;

  constructor({
    collateral = 0,
    debt = 0,
    stake = 0,
    snapshotOfTotalRedistributed
  }: TrovishWithPendingRewards = {}) {
    super({ collateral, debt });

    this.stake = Decimal.from(stake);
    this.snapshotOfTotalRedistributed = new Trove({
      ...snapshotOfTotalRedistributed,
      virtualDebt: 0
    });
  }

  applyRewards(totalRedistributed: Trove) {
    return this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );
  }

  equals(that: TroveWithPendingRewards) {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}
