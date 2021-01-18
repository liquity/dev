import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

export interface Trovish {
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

export type TroveCreationError = "missingGasDeposit";

export type TaggedInvalidTroveCreation = {
  type: "invalidCreation";
  invalidTrove: Trove;
  error: TroveCreationError;
};

export type TaggedTroveCreation<T> = { type: "creation"; params: TroveCreation<T> };

export type TaggedTroveClosure<T> = { type: "closure"; params: TroveClosure<T> };

export type TaggedTroveAdjustment<T> = {
  type: "adjustment";
  params: TroveAdjustment<T>;
  setToZero?: "collateral" | "debt";
};

export const invalidTroveCreation = (
  invalidTrove: Trove,
  error: TroveCreationError
): TaggedInvalidTroveCreation => ({
  type: "invalidCreation",
  invalidTrove,
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

export const troveAdjustment = <T>(
  params: TroveAdjustment<T>,
  setToZero?: "collateral" | "debt"
): TaggedTroveAdjustment<T> => ({
  type: "adjustment",
  params,
  setToZero
});

export type TroveChange<T> =
  | TaggedInvalidTroveCreation
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

type Normalizer<T, U> = (params: T) => U;

export const normalizeTroveCreation = (normalize as unknown) as Normalizer<
  TroveCreation<Decimalish>,
  TroveCreation<Decimal>
>;

export const normalizeTroveAdjustment = (normalize as unknown) as Normalizer<
  TroveAdjustment<Decimalish>,
  TroveAdjustment<Decimal>
>;

const applyFee = (borrowingFeeFactor: Decimalish, debtIncrease: Decimalish) =>
  Decimal.ONE.add(borrowingFeeFactor).mul(debtIncrease);

const unapplyFee = (borrowingFeeFactor: Decimalish, debtIncrease: Decimalish) =>
  Decimal.from(debtIncrease).div(Decimal.ONE.add(borrowingFeeFactor));

const NOMINAL_COLLATERAL_RATIO_PRECISION = Decimal.from(100);

export class Trove {
  public static readonly MINIMUM_COLLATERAL_RATIO_FOR_NEW_TROVE_IN_RECOVERY = Decimal.from(3);
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

  get nominalCollateralRatio(): Decimal {
    return this.collateral.mulDiv(NOMINAL_COLLATERAL_RATIO_PRECISION, this.debt);
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

  isOpenableInRecoveryMode(price: Decimalish): boolean {
    return this.collateralRatio(price).gte(Trove.MINIMUM_COLLATERAL_RATIO_FOR_NEW_TROVE_IN_RECOVERY);
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

  subtract(that: Trovish): Trove {
    const { collateral, debt } = new Trove(that);

    return new Trove({
      collateral: this.collateral.gt(collateral) ? this.collateral.sub(collateral) : 0,
      debt: this.debt.gt(debt) ? this.debt.sub(debt) : 0
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

  private debtChange({ debt }: Trove, borrowingFeeFactor: Decimalish): DebtChange<Decimal> {
    return debt.gt(this.debt)
      ? { borrowLUSD: unapplyFee(borrowingFeeFactor, debt.sub(this.debt)) }
      : { repayLUSD: this.debt.sub(debt) };
  }

  private collateralChange({ collateral }: Trove): CollateralChange<Decimal> {
    return collateral.gt(this.collateral)
      ? { depositCollateral: collateral.sub(this.collateral) }
      : { withdrawCollateral: this.collateral.sub(collateral) };
  }

  whatChanged(
    that: Trove,
    borrowingFeeFactor: Decimalish = Decimal.ZERO
  ): TroveChange<Decimal> | undefined {
    if (this.equals(that)) {
      return undefined;
    }

    if (this.isEmpty) {
      if (that.debt.lt(Trove.GAS_COMPENSATION_DEPOSIT)) {
        return invalidTroveCreation(that, "missingGasDeposit");
      }

      return troveCreation(
        that.netDebt.nonZero
          ? {
              depositCollateral: that.collateral,
              borrowLUSD: unapplyFee(borrowingFeeFactor, that.netDebt)
            }
          : { depositCollateral: that.collateral }
      );
    }

    if (that.isEmpty) {
      return troveClosure(
        this.netDebt.nonZero
          ? { withdrawCollateral: this.collateral, repayLUSD: this.netDebt }
          : { withdrawCollateral: this.collateral }
      );
    }

    return this.collateral.eq(that.collateral)
      ? troveAdjustment<Decimal>(this.debtChange(that, borrowingFeeFactor), that.debt.zero && "debt")
      : this.debt.eq(that.debt)
      ? troveAdjustment<Decimal>(this.collateralChange(that), that.collateral.zero && "collateral")
      : troveAdjustment<Decimal>(
          {
            ...this.debtChange(that, borrowingFeeFactor),
            ...this.collateralChange(that)
          },
          (that.debt.zero && "debt") ?? (that.collateral.zero && "collateral")
        );
  }

  apply(
    change: TroveChange<Decimalish> | undefined,
    borrowingFeeFactor: Decimalish = Decimal.ZERO
  ): Trove {
    if (!change) {
      return this;
    }

    switch (change.type) {
      case "invalidCreation":
        if (!this.isEmpty) {
          throw new Error("Can't create onto existing Trove");
        }

        return change.invalidTrove;

      case "creation": {
        if (!this.isEmpty) {
          throw new Error("Can't create onto existing Trove");
        }

        const { depositCollateral, borrowLUSD } = change.params;

        return new Trove({
          collateral: depositCollateral,
          debt: borrowLUSD
            ? Trove.GAS_COMPENSATION_DEPOSIT.add(applyFee(borrowingFeeFactor, borrowLUSD))
            : Trove.GAS_COMPENSATION_DEPOSIT
        });
      }

      case "closure":
        if (this.isEmpty) {
          throw new Error("Can't close empty Trove");
        }

        return emptyTrove;

      case "adjustment": {
        const {
          setToZero,
          params: { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD }
        } = change;

        const collateralDecrease = { collateral: withdrawCollateral };
        const collateralIncrease = { collateral: depositCollateral };
        const debtDecrease = { debt: repayLUSD };
        const debtIncrease = { debt: borrowLUSD && applyFee(borrowingFeeFactor, borrowLUSD) };

        return setToZero === "collateral"
          ? this.setCollateral(0).add(debtIncrease).subtract(debtDecrease)
          : setToZero === "debt"
          ? this.setDebt(0).add(collateralIncrease).subtract(collateralDecrease)
          : this.add({
              ...collateralIncrease,
              ...debtIncrease
            }).subtract({
              ...collateralDecrease,
              ...debtDecrease
            });
      }
    }
  }

  static create(params: TroveCreation<Decimalish>, borrowingFeeFactor?: Decimalish): Trove {
    return emptyTrove.apply(troveCreation(params), borrowingFeeFactor);
  }

  static recreate(that: Trove, borrowingFeeFactor?: Decimalish): TroveCreation<Decimal> {
    const change = emptyTrove.whatChanged(that, borrowingFeeFactor);
    assert(change?.type === "creation");
    return change.params;
  }

  adjust(params: TroveAdjustment<Decimalish>, borrowingFeeFactor?: Decimalish): Trove {
    return this.apply(troveAdjustment(params), borrowingFeeFactor);
  }

  adjustTo(that: Trove, borrowingFeeFactor?: Decimalish): TroveAdjustment<Decimal> {
    const change = this.whatChanged(that, borrowingFeeFactor);
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
