import assert from "assert";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  LUSD_LIQUIDATION_RESERVE,
  MINIMUM_BORROWING_RATE
} from "./constants";

/** @internal */ export type _CollateralDeposit<T> = { depositCollateral: T };
/** @internal */ export type _CollateralWithdrawal<T> = { withdrawCollateral: T };
/** @internal */ export type _LUSDBorrowing<T> = { borrowLUSD: T };
/** @internal */ export type _LUSDRepayment<T> = { repayLUSD: T };

/** @internal */ export type _NoCollateralDeposit = Partial<_CollateralDeposit<undefined>>;
/** @internal */ export type _NoCollateralWithdrawal = Partial<_CollateralWithdrawal<undefined>>;
/** @internal */ export type _NoLUSDBorrowing = Partial<_LUSDBorrowing<undefined>>;
/** @internal */ export type _NoLUSDRepayment = Partial<_LUSDRepayment<undefined>>;

/** @internal */
export type _CollateralChange<T> =
  | (_CollateralDeposit<T> & _NoCollateralWithdrawal)
  | (_CollateralWithdrawal<T> & _NoCollateralDeposit);

/** @internal */
export type _NoCollateralChange = _NoCollateralDeposit & _NoCollateralWithdrawal;

/** @internal */
export type _DebtChange<T> =
  | (_LUSDBorrowing<T> & _NoLUSDRepayment)
  | (_LUSDRepayment<T> & _NoLUSDBorrowing);

/** @internal */
export type _NoDebtChange = _NoLUSDBorrowing & _NoLUSDRepayment;

/**
 * Parameters of Trove creation.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular `TroveCreationParams`
 * object's properties.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> depositCollateral </td>
 *     <td> T </td>
 *     <td> The amount of collateral that's deposited. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> borrowLUSD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of LUSD that's borrowed. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type TroveCreationParams<T> = _CollateralDeposit<T> &
  _NoCollateralWithdrawal &
  Partial<_LUSDBorrowing<T>> &
  _NoLUSDRepayment;

/**
 * Parameters of Trove closure.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular `TroveClosureParams`
 * object's properties.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> withdrawCollateral </td>
 *     <td> T </td>
 *     <td> The amount of collateral that's withdrawn. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> repayLUSD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of LUSD that's repaid. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type TroveClosureParams<T> = _CollateralWithdrawal<T> &
  _NoCollateralDeposit &
  Partial<_LUSDRepayment<T>> &
  _NoLUSDBorrowing;

/**
 * Parameters of Trove adjustment.
 *
 * @remarks
 * The type parameter `T` specifies the allowed value type(s) of the particular
 * `TroveAdjustmentParams` object's properties.
 *
 * Even though all properties are optional, a valid `TroveAdjustmentParams` object must define at
 * least one.
 *
 * Defining both `depositCollateral` and `withdrawCollateral`, or both `borrowLUSD` and `repayLUSD`
 * at the same time is disallowed, and will result in a type-checking error.
 *
 * <h2>Properties</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Property </th>
 *     <th> Type </th>
 *     <th> Description </th>
 *   </tr>
 *
 *   <tr>
 *     <td> depositCollateral? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of collateral that's deposited. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> withdrawCollateral? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of collateral that's withdrawn. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> borrowLUSD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of LUSD that's borrowed. </td>
 *   </tr>
 *
 *   <tr>
 *     <td> repayLUSD? </td>
 *     <td> T </td>
 *     <td> <i>(Optional)</i> The amount of LUSD that's repaid. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type TroveAdjustmentParams<T> =
  | (_CollateralChange<T> & _NoDebtChange)
  | (_DebtChange<T> & _NoCollateralChange)
  | (_CollateralChange<T> & _DebtChange<T>);

/**
 * Describes why a Trove could not be created.
 *
 * @remarks
 * See {@link TroveChange}.
 *
 * <h2>Possible values</h2>
 *
 * <table>
 *
 *   <tr>
 *     <th> Value </th>
 *     <th> Reason </th>
 *   </tr>
 *
 *   <tr>
 *     <td> "missingLiquidationReserve" </td>
 *     <td> A Trove's debt cannot be less than the liquidation reserve. </td>
 *   </tr>
 *
 * </table>
 *
 * More errors may be added in the future.
 *
 * @public
 */
export type TroveCreationError = "missingLiquidationReserve";

/**
 * Represents the change from one Trove to another.
 *
 * @remarks
 * Returned by {@link Trove.whatChanged | Trove.whatChanged()}.
 *
 * Passed as a parameter to {@link Trove.apply | Trove.apply()}.
 *
 * @public
 */
export type TroveChange<T> =
  | { type: "invalidCreation"; invalidTrove: Trove; error: TroveCreationError }
  | { type: "creation"; params: TroveCreationParams<T> }
  | { type: "closure"; params: TroveClosureParams<T> }
  | { type: "adjustment"; params: TroveAdjustmentParams<T>; setToZero?: "collateral" | "debt" };

// This might seem backwards, but this way we avoid spamming the .d.ts and generated docs
type InvalidTroveCreation = Extract<TroveChange<never>, { type: "invalidCreation" }>;
type TroveCreation<T> = Extract<TroveChange<T>, { type: "creation" }>;
type TroveClosure<T> = Extract<TroveChange<T>, { type: "closure" }>;
type TroveAdjustment<T> = Extract<TroveChange<T>, { type: "adjustment" }>;

const invalidTroveCreation = (
  invalidTrove: Trove,
  error: TroveCreationError
): InvalidTroveCreation => ({
  type: "invalidCreation",
  invalidTrove,
  error
});

const troveCreation = <T>(params: TroveCreationParams<T>): TroveCreation<T> => ({
  type: "creation",
  params
});

const troveClosure = <T>(params: TroveClosureParams<T>): TroveClosure<T> => ({
  type: "closure",
  params
});

const troveAdjustment = <T>(
  params: TroveAdjustmentParams<T>,
  setToZero?: "collateral" | "debt"
): TroveAdjustment<T> => ({
  type: "adjustment",
  params,
  setToZero
});

const normalize = (params: Record<string, Decimalish | undefined>): Record<string, Decimal> =>
  Object.fromEntries(
    Object.entries(params)
      .filter((kv): kv is [string, Decimalish] => kv[1] !== undefined)
      .map(([k, v]): [string, Decimal] => [k, Decimal.from(v)])
      .filter(([, v]) => v.nonZero)
  );

/** @internal */ export type _Normalizer<T, U> = (params: T) => U;

/** @internal */
export const _normalizeTroveCreation = (normalize as unknown) as _Normalizer<
  TroveCreationParams<Decimalish>,
  TroveCreationParams<Decimal>
>;

/** @internal */
export const _normalizeTroveAdjustment = (normalize as unknown) as _Normalizer<
  TroveAdjustmentParams<Decimalish>,
  TroveAdjustmentParams<Decimal>
>;

const applyFee = (borrowingRate: Decimalish, debtIncrease: Decimalish) =>
  Decimal.ONE.add(borrowingRate).mul(debtIncrease);

const unapplyFee = (borrowingRate: Decimalish, debtIncrease: Decimalish) =>
  Decimal.from(debtIncrease).div(Decimal.ONE.add(borrowingRate));

const NOMINAL_COLLATERAL_RATIO_PRECISION = Decimal.from(100);

/** @public */
export class Trove {
  readonly collateral: Decimal;
  readonly debt: Decimal;

  /** @internal */
  constructor(collateral = Decimal.ZERO, debt = Decimal.ZERO) {
    this.collateral = collateral;
    this.debt = debt;
  }

  get isEmpty(): boolean {
    return this.collateral.isZero && this.debt.isZero;
  }

  /**
   * Amount of LUSD that must be repaid to close this Trove.
   *
   * @remarks
   * This doesn't include the liquidation reserve, which is refunded in case of normal closure.
   */
  get netDebt(): Decimal {
    if (this.debt.lt(LUSD_LIQUIDATION_RESERVE)) {
      throw new Error(`netDebt should not be used when debt < ${LUSD_LIQUIDATION_RESERVE}`);
    }

    return this.debt.sub(LUSD_LIQUIDATION_RESERVE);
  }

  /** @internal */
  get _nominalCollateralRatio(): Decimal {
    return this.collateral.mulDiv(NOMINAL_COLLATERAL_RATIO_PRECISION, this.debt);
  }

  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.debt);
  }

  collateralRatioIsBelowMinimum(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(MINIMUM_COLLATERAL_RATIO);
  }

  collateralRatioIsBelowCritical(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(CRITICAL_COLLATERAL_RATIO);
  }

  isOpenableInRecoveryMode(price: Decimalish): boolean {
    return this.collateralRatio(price).gte(CRITICAL_COLLATERAL_RATIO);
  }

  toString(): string {
    return `{ collateral: ${this.collateral}, debt: ${this.debt} }`;
  }

  equals(that: Trove): boolean {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add(that: Trove): Trove {
    return new Trove(this.collateral.add(that.collateral), this.debt.add(that.debt));
  }

  addCollateral(collateral: Decimalish): Trove {
    return new Trove(this.collateral.add(collateral), this.debt);
  }

  addDebt(debt: Decimalish): Trove {
    return new Trove(this.collateral, this.debt.add(debt));
  }

  subtract(that: Trove): Trove {
    const { collateral, debt } = that;

    return new Trove(
      this.collateral.gt(collateral) ? this.collateral.sub(collateral) : Decimal.ZERO,
      this.debt.gt(debt) ? this.debt.sub(debt) : Decimal.ZERO
    );
  }

  subtractCollateral(collateral: Decimalish): Trove {
    return new Trove(
      this.collateral.gt(collateral) ? this.collateral.sub(collateral) : Decimal.ZERO,
      this.debt
    );
  }

  subtractDebt(debt: Decimalish): Trove {
    return new Trove(this.collateral, this.debt.gt(debt) ? this.debt.sub(debt) : Decimal.ZERO);
  }

  multiply(multiplier: Decimalish): Trove {
    return new Trove(this.collateral.mul(multiplier), this.debt.mul(multiplier));
  }

  setCollateral(collateral: Decimalish): Trove {
    return new Trove(Decimal.from(collateral), this.debt);
  }

  setDebt(debt: Decimalish): Trove {
    return new Trove(this.collateral, Decimal.from(debt));
  }

  private _debtChange({ debt }: Trove, borrowingRate: Decimalish): _DebtChange<Decimal> {
    return debt.gt(this.debt)
      ? { borrowLUSD: unapplyFee(borrowingRate, debt.sub(this.debt)) }
      : { repayLUSD: this.debt.sub(debt) };
  }

  private _collateralChange({ collateral }: Trove): _CollateralChange<Decimal> {
    return collateral.gt(this.collateral)
      ? { depositCollateral: collateral.sub(this.collateral) }
      : { withdrawCollateral: this.collateral.sub(collateral) };
  }

  whatChanged(
    that: Trove,
    borrowingRate: Decimalish = MINIMUM_BORROWING_RATE
  ): TroveChange<Decimal> | undefined {
    if (this.equals(that)) {
      return undefined;
    }

    if (this.isEmpty) {
      if (that.debt.lt(LUSD_LIQUIDATION_RESERVE)) {
        return invalidTroveCreation(that, "missingLiquidationReserve");
      }

      return troveCreation(
        that.netDebt.nonZero
          ? {
              depositCollateral: that.collateral,
              borrowLUSD: unapplyFee(borrowingRate, that.netDebt)
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
      ? troveAdjustment<Decimal>(this._debtChange(that, borrowingRate), that.debt.zero && "debt")
      : this.debt.eq(that.debt)
      ? troveAdjustment<Decimal>(this._collateralChange(that), that.collateral.zero && "collateral")
      : troveAdjustment<Decimal>(
          {
            ...this._debtChange(that, borrowingRate),
            ...this._collateralChange(that)
          },
          (that.debt.zero && "debt") ?? (that.collateral.zero && "collateral")
        );
  }

  apply(
    change: TroveChange<Decimalish> | undefined,
    borrowingRate: Decimalish = MINIMUM_BORROWING_RATE
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

        return new Trove(
          Decimal.from(depositCollateral),
          borrowLUSD
            ? LUSD_LIQUIDATION_RESERVE.add(applyFee(borrowingRate, borrowLUSD))
            : LUSD_LIQUIDATION_RESERVE
        );
      }

      case "closure":
        if (this.isEmpty) {
          throw new Error("Can't close empty Trove");
        }

        return _emptyTrove;

      case "adjustment": {
        const {
          setToZero,
          params: { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD }
        } = change;

        const collateralDecrease = Decimal.from(withdrawCollateral ?? 0);
        const collateralIncrease = Decimal.from(depositCollateral ?? 0);
        const debtDecrease = Decimal.from(repayLUSD ?? 0);
        const debtIncrease = borrowLUSD ? applyFee(borrowingRate, borrowLUSD) : Decimal.ZERO;

        return setToZero === "collateral"
          ? this.setCollateral(0).addDebt(debtIncrease).subtractDebt(debtDecrease)
          : setToZero === "debt"
          ? this.setDebt(0).addCollateral(collateralIncrease).subtractCollateral(collateralDecrease)
          : this.add(new Trove(collateralIncrease, debtIncrease)).subtract(
              new Trove(collateralDecrease, debtDecrease)
            );
      }
    }
  }

  static create(params: TroveCreationParams<Decimalish>, borrowingRate?: Decimalish): Trove {
    return _emptyTrove.apply(troveCreation(params), borrowingRate);
  }

  static recreate(that: Trove, borrowingRate?: Decimalish): TroveCreationParams<Decimal> {
    const change = _emptyTrove.whatChanged(that, borrowingRate);
    assert(change?.type === "creation");
    return change.params;
  }

  adjust(params: TroveAdjustmentParams<Decimalish>, borrowingRate?: Decimalish): Trove {
    return this.apply(troveAdjustment(params), borrowingRate);
  }

  adjustTo(that: Trove, borrowingRate?: Decimalish): TroveAdjustmentParams<Decimal> {
    const change = this.whatChanged(that, borrowingRate);
    assert(change?.type === "adjustment");
    return change.params;
  }
}

/** @internal */
export const _emptyTrove = new Trove();

/** @public */
export class TroveWithPendingRedistribution extends Trove {
  readonly stake: Decimal;
  readonly snapshotOfTotalRedistributed: Trove;

  constructor(
    collateral?: Decimal,
    debt?: Decimal,
    stake = Decimal.ZERO,
    snapshotOfTotalRedistributed = _emptyTrove
  ) {
    super(collateral, debt);

    this.stake = stake;
    this.snapshotOfTotalRedistributed = snapshotOfTotalRedistributed;
  }

  applyRedistribution(totalRedistributed: Trove): Trove {
    return this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );
  }

  equals(that: TroveWithPendingRedistribution): boolean {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}
