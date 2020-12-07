import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
}

type CollateralDeposit<T> = {
  depositCollateral: T;
};

type CollateralWithdrawal<T> = {
  withdrawCollateral: T;
};

type LUSDBorrowing<T> = {
  borrowLUSD: T;
};

type LUSDRepayment<T> = {
  repayLUSD: T;
};

type NoCollateralDeposit = Partial<CollateralDeposit<never>>;
type NoCollateralWithdrawal = Partial<CollateralWithdrawal<never>>;
type NoLUSDBorrowing = Partial<LUSDBorrowing<never>>;
type NoLUSDRepayment = Partial<LUSDRepayment<never>>;

type CollateralChange<T> =
  | (CollateralDeposit<T> & NoCollateralWithdrawal)
  | (CollateralWithdrawal<T> & NoCollateralDeposit);
type NoCollateralChange = NoCollateralDeposit & NoCollateralWithdrawal;

type DebtChange<T> = (LUSDBorrowing<T> & NoLUSDRepayment) | (LUSDRepayment<T> & NoLUSDBorrowing);
type NoDebtChange = NoLUSDBorrowing & NoLUSDRepayment;

export type TroveCreation<T> = CollateralDeposit<T> &
  NoCollateralWithdrawal &
  Partial<LUSDBorrowing<T>> &
  NoLUSDRepayment;

export type TroveClosure<T> = CollateralWithdrawal<T> &
  NoCollateralDeposit &
  Partial<LUSDRepayment<T>> &
  NoLUSDBorrowing;

export type TroveAdjustment<T> =
  | (CollateralChange<T> & NoDebtChange)
  | (DebtChange<T> & NoCollateralChange)
  | (CollateralChange<T> & DebtChange<T>);

export type TroveChangeError = "missingGasDeposit";

export type TaggedTroveChangeError = { type: "invalid"; error: TroveChangeError };
export type TaggedTroveCreation<T> = { type: "creation"; params: TroveCreation<T> };
export type TaggedTroveClosure<T> = { type: "closure"; params: TroveClosure<T> };
export type TaggedTroveAdjustment<T> = { type: "adjustment"; params: TroveAdjustment<T> };

export const invalidTroveChange = (error: TroveChangeError): TaggedTroveChangeError => ({
  type: "invalid",
  error
});

export const troveCreation = <T>(params: TroveCreation<T>): TaggedTroveCreation<T> => ({
  type: "creation",
  params
});

export const troveClosure = <T>(params: TroveClosure<T>): TaggedTroveClosure<T> => ({
  type: "closure",
  params
});

export const troveAdjustment = <T>(params: TroveAdjustment<T>): TaggedTroveAdjustment<T> => ({
  type: "adjustment",
  params
});

export type TroveChange<T> =
  | TaggedTroveChangeError
  | TaggedTroveCreation<T>
  | TaggedTroveClosure<T>
  | TaggedTroveAdjustment<T>;

const normalize = (params: Record<string, Decimalish | undefined>): Record<string, Decimal> =>
  Object.fromEntries(
    Object.entries(params)
      .filter((kv): kv is [string, Decimalish] => kv[1] !== undefined)
      .map(([k, v]): [string, Decimal] => [k, Decimal.from(v)])
      .filter(([, v]) => v.nonZero)
  );

export const normalizeTroveCreation: (
  params: TroveCreation<Decimalish>
) => TroveCreation<Decimal> = (normalize as unknown) as (
  params: TroveCreation<Decimalish>
) => TroveCreation<Decimal>;

export const normalizeTroveAdjustment: (
  params: TroveAdjustment<Decimalish>
) => TroveAdjustment<Decimal> = (normalize as unknown) as (
  params: TroveAdjustment<Decimalish>
) => TroveAdjustment<Decimal>;

const applyFee = (borrowingFee: Decimalish, debtIncrease: Decimalish) =>
  Decimal.ONE.add(borrowingFee).mul(debtIncrease);

const invertFee = (borrowingFee: Decimalish, debtIncrease: Decimalish) =>
  Decimal.from(debtIncrease).div(Decimal.ONE.add(borrowingFee));

export class Trove {
  public static readonly CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);
  public static readonly MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);
  /**
   * Amount automatically minted and assigned to gas compensation pool for each Trove opened,
   * it counts towards collateral ratio (lowers it).
   */
  public static readonly GAS_COMPENSATION_DEPOSIT: Decimal = Decimal.from(10);

  readonly collateral: Decimal;
  readonly debt: Decimal;

  constructor({ collateral = 0, debt = 0 }: Trovish = {}) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
  }

  get isEmpty(): boolean {
    return this.collateral.isZero && this.debt.isZero;
  }

  get netDebt(): Decimal {
    if (this.debt.lt(Trove.GAS_COMPENSATION_DEPOSIT)) {
      throw new Error(`netDebt should not be used when debt < ${Trove.GAS_COMPENSATION_DEPOSIT}`);
    }

    return this.debt.sub(Trove.GAS_COMPENSATION_DEPOSIT);
  }

  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.debt);
  }

  collateralRatioIsBelowMinimum(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(Trove.MINIMUM_COLLATERAL_RATIO);
  }

  collateralRatioIsBelowCritical(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(Trove.CRITICAL_COLLATERAL_RATIO);
  }

  toString(): string {
    return `{ collateral: ${this.collateral}, debt: ${this.debt} }`;
  }

  equals(that: Trove): boolean {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add({ collateral = 0, debt = 0 }: Trovish): Trove {
    return new Trove({
      collateral: this.collateral.add(collateral),
      debt: this.debt.add(debt)
    });
  }

  addCollateral(collateral: Decimalish): Trove {
    return this.add({ collateral });
  }

  addDebt(debt: Decimalish): Trove {
    return this.add({ debt });
  }

  subtract({ collateral = 0, debt = 0 }: Trovish): Trove {
    return new Trove({
      collateral: this.collateral.sub(collateral),
      debt: this.debt.sub(debt)
    });
  }

  subtractCollateral(collateral: Decimalish): Trove {
    return this.subtract({ collateral });
  }

  subtractDebt(debt: Decimalish): Trove {
    return this.subtract({ debt });
  }

  multiply(multiplier: Decimalish): Trove {
    return new Trove({
      collateral: this.collateral.mul(multiplier),
      debt: this.debt.mul(multiplier)
    });
  }

  setCollateral(collateral: Decimalish): Trove {
    return new Trove({
      collateral,
      debt: this.debt
    });
  }

  setDebt(debt: Decimalish): Trove {
    return new Trove({
      collateral: this.collateral,
      debt
    });
  }

  private debtChange({ debt }: Trove, borrowingFee: Decimalish): DebtChange<Decimal> {
    return debt.gt(this.debt)
      ? { borrowLUSD: invertFee(borrowingFee, debt.sub(this.debt)) }
      : { repayLUSD: this.debt.sub(debt) };
  }

  private collateralChange({ collateral }: Trove): CollateralChange<Decimal> {
    return collateral.gt(this.collateral)
      ? { depositCollateral: collateral.sub(this.collateral) }
      : { withdrawCollateral: this.collateral.sub(collateral) };
  }

  whatChanged(
    that: Trove,
    borrowingFee: Decimalish = Decimal.ZERO
  ): TroveChange<Decimal> | undefined {
    if (this.equals(that)) {
      return undefined;
    }

    if (that.collateral.nonZero && that.debt.lt(Trove.GAS_COMPENSATION_DEPOSIT)) {
      return invalidTroveChange("missingGasDeposit");
    }

    if (this.isEmpty) {
      return troveCreation(
        that.netDebt.gt(Decimal.ZERO)
          ? { depositCollateral: that.collateral, borrowLUSD: invertFee(borrowingFee, that.netDebt) }
          : { depositCollateral: that.collateral }
      );
    }

    if (that.isEmpty) {
      return troveClosure(
        this.netDebt.gt(Decimal.ZERO)
          ? { withdrawCollateral: this.collateral, repayLUSD: this.netDebt }
          : { withdrawCollateral: this.collateral }
      );
    }

    return troveAdjustment<Decimal>(
      this.collateral.eq(that.collateral)
        ? this.debtChange(that, borrowingFee)
        : this.debt.eq(that.debt)
        ? this.collateralChange(that)
        : {
            ...this.debtChange(that, borrowingFee),
            ...this.collateralChange(that)
          }
    );
  }

  apply(
    change: TroveChange<Decimalish> | undefined,
    borrowingFee: Decimalish = Decimal.ZERO
  ): Trove {
    if (!change) {
      return this;
    }

    if (change.type === "invalid") {
      throw new Error(`Can't apply invalid change (error: "${change.error}")`);
    }

    switch (change.type) {
      case "creation": {
        if (!this.isEmpty) {
          return this;
        }

        const { depositCollateral, borrowLUSD } = change.params;

        return new Trove({
          collateral: depositCollateral,
          debt: borrowLUSD
            ? Trove.GAS_COMPENSATION_DEPOSIT.add(applyFee(borrowingFee, borrowLUSD))
            : Trove.GAS_COMPENSATION_DEPOSIT
        });
      }

      case "closure":
        return emptyTrove;

      case "adjustment": {
        const { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD } = change.params;

        return this.add({
          collateral: depositCollateral,
          debt: borrowLUSD ? applyFee(borrowingFee, borrowLUSD) : 0
        }).subtract({
          collateral: withdrawCollateral,
          debt: repayLUSD
        });
      }
    }
  }

  static create(params: TroveCreation<Decimalish>, borrowingFee?: Decimalish): Trove {
    return emptyTrove.apply(troveCreation(params), borrowingFee);
  }

  static recreate(that: Trove, borrowingFee?: Decimalish): TroveCreation<Decimal> {
    const change = emptyTrove.whatChanged(that, borrowingFee);
    assert(change?.type === "creation");
    return change.params;
  }

  adjust(params: TroveAdjustment<Decimalish>, borrowingFee?: Decimalish): Trove {
    return this.apply(troveAdjustment(params), borrowingFee);
  }

  adjustTo(that: Trove, borrowingFee?: Decimalish): TroveAdjustment<Decimal> {
    const change = this.whatChanged(that, borrowingFee);
    assert(change?.type === "adjustment");
    return change.params;
  }
}

export const emptyTrove = new Trove({ collateral: 0, debt: 0 });

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
    this.snapshotOfTotalRedistributed = new Trove({ ...snapshotOfTotalRedistributed });
  }

  applyRewards(totalRedistributed: Trove): Trove {
    return this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );
  }

  equals(that: TroveWithPendingRewards): boolean {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}
