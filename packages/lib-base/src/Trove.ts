import assert from "assert";

import { Decimal, Decimalish } from "./Decimal";

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
 * Parameters of an {@link TransactableLiquity.openTrove | openTrove()} transaction.
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
 *     <td> borrowLUSD </td>
 *     <td> T </td>
 *     <td> The amount of LUSD that's borrowed. </td>
 *   </tr>
 *
 * </table>
 *
 * @public
 */
export type TroveCreationParams<T = unknown> = _CollateralDeposit<T> &
  _NoCollateralWithdrawal &
  _LUSDBorrowing<T> &
  _NoLUSDRepayment;

/**
 * Parameters of a {@link TransactableLiquity.closeTrove | closeTrove()} transaction.
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
 * Parameters of an {@link TransactableLiquity.adjustTrove | adjustTrove()} transaction.
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
export type TroveAdjustmentParams<T = unknown> =
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
 * Represents the change between two Trove states.
 *
 * @remarks
 * Returned by {@link Trove.whatChanged}.
 *
 * Passed as a parameter to {@link Trove.apply}.
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

const valueIsDefined = <T>(entry: [string, T | undefined]): entry is [string, T] =>
  entry[1] !== undefined;

type AllowedKey<T> = Exclude<
  {
    [P in keyof T]: T[P] extends undefined ? never : P;
  }[keyof T],
  undefined
>;

const allowedTroveCreationKeys: AllowedKey<TroveCreationParams>[] = [
  "depositCollateral",
  "borrowLUSD"
];

function checkAllowedTroveCreationKeys<T>(
  entries: [string, T][]
): asserts entries is [AllowedKey<TroveCreationParams>, T][] {
  const badKeys = entries
    .filter(([k]) => !(allowedTroveCreationKeys as string[]).includes(k))
    .map(([k]) => `'${k}'`);

  if (badKeys.length > 0) {
    throw new Error(`TroveCreationParams: property ${badKeys.join(", ")} not allowed`);
  }
}

const troveCreationParamsFromEntries = <T>(
  entries: [AllowedKey<TroveCreationParams>, T][]
): TroveCreationParams<T> => {
  const params = Object.fromEntries(entries) as Record<AllowedKey<TroveCreationParams>, T>;
  const missingKeys = allowedTroveCreationKeys.filter(k => !(k in params)).map(k => `'${k}'`);

  if (missingKeys.length > 0) {
    throw new Error(`TroveCreationParams: property ${missingKeys.join(", ")} missing`);
  }

  return params;
};

const decimalize = <T>([k, v]: [T, Decimalish]): [T, Decimal] => [k, Decimal.from(v)];
const nonZero = <T>([, v]: [T, Decimal]): boolean => !v.isZero;

/** @internal */
export const _normalizeTroveCreation = (
  params: Record<string, Decimalish | undefined>
): TroveCreationParams<Decimal> => {
  const definedEntries = Object.entries(params).filter(valueIsDefined);
  checkAllowedTroveCreationKeys(definedEntries);
  const nonZeroEntries = definedEntries.map(decimalize);

  return troveCreationParamsFromEntries(nonZeroEntries);
};

const allowedTroveAdjustmentKeys: AllowedKey<TroveAdjustmentParams>[] = [
  "depositCollateral",
  "withdrawCollateral",
  "borrowLUSD",
  "repayLUSD"
];

function checkAllowedTroveAdjustmentKeys<T>(
  entries: [string, T][]
): asserts entries is [AllowedKey<TroveAdjustmentParams>, T][] {
  const badKeys = entries
    .filter(([k]) => !(allowedTroveAdjustmentKeys as string[]).includes(k))
    .map(([k]) => `'${k}'`);

  if (badKeys.length > 0) {
    throw new Error(`TroveAdjustmentParams: property ${badKeys.join(", ")} not allowed`);
  }
}

const collateralChangeFrom = <T>({
  depositCollateral,
  withdrawCollateral
}: Partial<Record<AllowedKey<TroveAdjustmentParams>, T>>): _CollateralChange<T> | undefined => {
  if (depositCollateral !== undefined && withdrawCollateral !== undefined) {
    throw new Error(
      "TroveAdjustmentParams: 'depositCollateral' and 'withdrawCollateral' " +
        "can't be present at the same time"
    );
  }

  if (depositCollateral !== undefined) {
    return { depositCollateral };
  }

  if (withdrawCollateral !== undefined) {
    return { withdrawCollateral };
  }
};

const debtChangeFrom = <T>({
  borrowLUSD,
  repayLUSD
}: Partial<Record<AllowedKey<TroveAdjustmentParams>, T>>): _DebtChange<T> | undefined => {
  if (borrowLUSD !== undefined && repayLUSD !== undefined) {
    throw new Error(
      "TroveAdjustmentParams: 'borrowLUSD' and 'repayLUSD' can't be present at the same time"
    );
  }

  if (borrowLUSD !== undefined) {
    return { borrowLUSD };
  }

  if (repayLUSD !== undefined) {
    return { repayLUSD };
  }
};

const troveAdjustmentParamsFromEntries = <T>(
  entries: [AllowedKey<TroveAdjustmentParams>, T][]
): TroveAdjustmentParams<T> => {
  const params = Object.fromEntries(entries) as Partial<
    Record<AllowedKey<TroveAdjustmentParams>, T>
  >;

  const collateralChange = collateralChangeFrom(params);
  const debtChange = debtChangeFrom(params);

  if (collateralChange !== undefined && debtChange !== undefined) {
    return { ...collateralChange, ...debtChange };
  }

  if (collateralChange !== undefined) {
    return collateralChange;
  }

  if (debtChange !== undefined) {
    return debtChange;
  }

  throw new Error("TroveAdjustmentParams: must include at least one non-zero parameter");
};

/** @internal */
export const _normalizeTroveAdjustment = (
  params: Record<string, Decimalish | undefined>
): TroveAdjustmentParams<Decimal> => {
  const definedEntries = Object.entries(params).filter(valueIsDefined);
  checkAllowedTroveAdjustmentKeys(definedEntries);
  const nonZeroEntries = definedEntries.map(decimalize).filter(nonZero);

  return troveAdjustmentParamsFromEntries(nonZeroEntries);
};

const applyFee = (borrowingRate: Decimalish, debtIncrease: Decimal) =>
  debtIncrease.mul(Decimal.ONE.add(borrowingRate));

const unapplyFee = (borrowingRate: Decimalish, debtIncrease: Decimal) =>
  debtIncrease._divCeil(Decimal.ONE.add(borrowingRate));

const NOMINAL_COLLATERAL_RATIO_PRECISION = Decimal.from(100);

/**
 * A combination of collateral and debt.
 *
 * @public
 */
export class Trove {
  /** Amount of native currency (e.g. Ether) collateralized. */
  readonly collateral: Decimal;

  /** Amount of LUSD owed. */
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

  /** Calculate the Trove's collateralization ratio at a given price. */
  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.debt);
  }

  /**
   * Whether the Trove is undercollateralized at a given price.
   *
   * @returns
   * `true` if the Trove's collateralization ratio is less than the
   * {@link MINIMUM_COLLATERAL_RATIO}.
   */
  collateralRatioIsBelowMinimum(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(MINIMUM_COLLATERAL_RATIO);
  }

  /**
   * Whether the collateralization ratio is less than the {@link CRITICAL_COLLATERAL_RATIO} at a
   * given price.
   *
   * @example
   * Can be used to check whether the Liquity protocol is in recovery mode by using it on the return
   * value of {@link ReadableLiquity.getTotal | getTotal()}. For example:
   *
   * ```typescript
   * const total = await liquity.getTotal();
   * const price = await liquity.getPrice();
   *
   * if (total.collateralRatioIsBelowCritical(price)) {
   *   // Recovery mode is active
   * }
   * ```
   */
  collateralRatioIsBelowCritical(price: Decimalish): boolean {
    return this.collateralRatio(price).lt(CRITICAL_COLLATERAL_RATIO);
  }

  /** Whether the Trove is sufficiently collateralized to be opened during recovery mode. */
  isOpenableInRecoveryMode(price: Decimalish): boolean {
    return this.collateralRatio(price).gte(CRITICAL_COLLATERAL_RATIO);
  }

  /** @internal */
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

  /**
   * Calculate the difference between this Trove and another.
   *
   * @param that - The other Trove.
   * @param borrowingRate - Borrowing rate to use when calculating a borrowed amount.
   *
   * @returns
   * An object representing the change, or `undefined` if the Troves are equal.
   */
  whatChanged(
    that: Trove,
    borrowingRate: Decimalish = MINIMUM_BORROWING_RATE
  ): TroveChange<Decimal> | undefined {
    if (this.collateral.eq(that.collateral) && this.debt.eq(that.debt)) {
      return undefined;
    }

    if (this.isEmpty) {
      if (that.debt.lt(LUSD_LIQUIDATION_RESERVE)) {
        return invalidTroveCreation(that, "missingLiquidationReserve");
      }

      return troveCreation({
        depositCollateral: that.collateral,
        borrowLUSD: unapplyFee(borrowingRate, that.netDebt)
      });
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

  /**
   * Make a new Trove by applying a {@link TroveChange} to this Trove.
   *
   * @param change - The change to apply.
   * @param borrowingRate - Borrowing rate to use when adding a borrowed amount to the Trove's debt.
   */
  apply(
    change: TroveChange<Decimal> | undefined,
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
          depositCollateral,
          LUSD_LIQUIDATION_RESERVE.add(applyFee(borrowingRate, borrowLUSD))
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

        const collateralDecrease = withdrawCollateral ?? Decimal.ZERO;
        const collateralIncrease = depositCollateral ?? Decimal.ZERO;
        const debtDecrease = repayLUSD ?? Decimal.ZERO;
        const debtIncrease = borrowLUSD ? applyFee(borrowingRate, borrowLUSD) : Decimal.ZERO;

        return setToZero === "collateral"
          ? this.setCollateral(Decimal.ZERO).addDebt(debtIncrease).subtractDebt(debtDecrease)
          : setToZero === "debt"
          ? this.setDebt(Decimal.ZERO)
              .addCollateral(collateralIncrease)
              .subtractCollateral(collateralDecrease)
          : this.add(new Trove(collateralIncrease, debtIncrease)).subtract(
              new Trove(collateralDecrease, debtDecrease)
            );
      }
    }
  }

  /**
   * Calculate the result of an {@link TransactableLiquity.openTrove | openTrove()} transaction.
   *
   * @param params - Parameters of the transaction.
   * @param borrowingRate - Borrowing rate to use when calculating the Trove's debt.
   */
  static create(params: TroveCreationParams<Decimalish>, borrowingRate?: Decimalish): Trove {
    return _emptyTrove.apply(troveCreation(_normalizeTroveCreation(params)), borrowingRate);
  }

  /**
   * Calculate the parameters of an {@link TransactableLiquity.openTrove | openTrove()} transaction
   * that will result in the given Trove.
   *
   * @param that - The Trove to recreate.
   * @param borrowingRate - Current borrowing rate.
   */
  static recreate(that: Trove, borrowingRate?: Decimalish): TroveCreationParams<Decimal> {
    const change = _emptyTrove.whatChanged(that, borrowingRate);
    assert(change?.type === "creation");
    return change.params;
  }

  /**
   * Calculate the result of an {@link TransactableLiquity.adjustTrove | adjustTrove()} transaction
   * on this Trove.
   *
   * @param params - Parameters of the transaction.
   * @param borrowingRate - Borrowing rate to use when adding to the Trove's debt.
   */
  adjust(params: TroveAdjustmentParams<Decimalish>, borrowingRate?: Decimalish): Trove {
    return this.apply(troveAdjustment(_normalizeTroveAdjustment(params)), borrowingRate);
  }

  /**
   * Calculate the parameters of an {@link TransactableLiquity.adjustTrove | adjustTrove()}
   * transaction that will change this Trove into the given Trove.
   *
   * @param that - The desired result of the transaction.
   * @param borrowingRate - Current borrowing rate.
   */
  adjustTo(that: Trove, borrowingRate?: Decimalish): TroveAdjustmentParams<Decimal> {
    const change = this.whatChanged(that, borrowingRate);
    assert(change?.type === "adjustment");
    return change.params;
  }
}

/** @internal */
export const _emptyTrove = new Trove();

/**
 * Represents whether a UserTrove is open or not, or why it was closed.
 *
 * @public
 */
export type UserTroveStatus =
  | "nonExistent"
  | "open"
  | "closedByOwner"
  | "closedByLiquidation"
  | "closedByRedemption";

/**
 * A Trove that is associated with a single owner.
 *
 * @remarks
 * The SDK uses the base {@link Trove} class as a generic container of collateral and debt, for
 * example to represent the {@link ReadableLiquity.getTotal | total collateral and debt} locked up
 * in the protocol.
 *
 * The `UserTrove` class extends `Trove` with extra information that's only available for Troves
 * that are associated with a single owner (such as the owner's address, or the Trove's status).
 *
 * @public
 */
export class UserTrove extends Trove {
  /** Address that owns this Trove. */
  readonly ownerAddress: string;

  /** Provides more information when the UserTrove is empty. */
  readonly status: UserTroveStatus;

  /** @internal */
  constructor(ownerAddress: string, status: UserTroveStatus, collateral?: Decimal, debt?: Decimal) {
    super(collateral, debt);

    this.ownerAddress = ownerAddress;
    this.status = status;
  }

  equals(that: UserTrove): boolean {
    return (
      super.equals(that) && this.ownerAddress === that.ownerAddress && this.status === that.status
    );
  }

  /** @internal */
  toString(): string {
    return (
      `{ ownerAddress: "${this.ownerAddress}"` +
      `, collateral: ${this.collateral}` +
      `, debt: ${this.debt}` +
      `, status: "${this.status}" }`
    );
  }
}

/**
 * A Trove in its state after the last direct modification.
 *
 * @remarks
 * The Trove may have received collateral and debt shares from liquidations since then.
 * Use {@link TroveWithPendingRedistribution.applyRedistribution | applyRedistribution()} to
 * calculate the Trove's most up-to-date state.
 *
 * @public
 */
export class TroveWithPendingRedistribution extends UserTrove {
  private readonly stake: Decimal;
  private readonly snapshotOfTotalRedistributed: Trove;

  /** @internal */
  constructor(
    ownerAddress: string,
    status: UserTroveStatus,
    collateral?: Decimal,
    debt?: Decimal,
    stake = Decimal.ZERO,
    snapshotOfTotalRedistributed = _emptyTrove
  ) {
    super(ownerAddress, status, collateral, debt);

    this.stake = stake;
    this.snapshotOfTotalRedistributed = snapshotOfTotalRedistributed;
  }

  applyRedistribution(totalRedistributed: Trove): UserTrove {
    const afterRedistribution = this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );

    return new UserTrove(
      this.ownerAddress,
      this.status,
      afterRedistribution.collateral,
      afterRedistribution.debt
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
