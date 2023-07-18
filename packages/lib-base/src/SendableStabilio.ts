import { Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableStabilio,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableStabilio";

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @stabilio/lib-ethers#SentEthersStabilioTransaction}.
 *
 * @public
 */
export interface SentStabilioTransaction<S = unknown, T extends StabilioReceipt = StabilioReceipt> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @stabilio/lib-base#SentStabilioTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @stabilio/lib-base#FailedReceipt} or a
   *          {@link @stabilio/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentStabilioTransaction.getReceipt}.
 *
 * @public
 */
export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

/**
 * Indicates that the transaction has been mined, but it failed.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * Returned by {@link SentStabilioTransaction.getReceipt} and
 * {@link SentStabilioTransaction.waitForReceipt}.
 *
 * @public
 */
export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

/**
 * Indicates that the transaction has succeeded.
 *
 * @remarks
 * The `rawReceipt` property is an implementation-specific transaction receipt object.
 *
 * The `details` property may contain more information about the transaction.
 * See the return types of {@link TransactableStabilio} functions for the exact contents of `details`
 * for each type of Stabilio transaction.
 *
 * Returned by {@link SentStabilioTransaction.getReceipt} and
 * {@link SentStabilioTransaction.waitForReceipt}.
 *
 * @public
 */
export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

/** @internal */
export const _successfulReceipt = <R, D>(
  rawReceipt: R,
  details: D,
  toString?: () => string
): SuccessfulReceipt<R, D> => ({
  status: "succeeded",
  rawReceipt,
  details,
  ...(toString ? { toString } : {})
});

/**
 * Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;

/**
 * One of either a {@link PendingReceipt}, a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
 *
 * @public
 */
export type StabilioReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

/** @internal */
export type _SendableFrom<T, R, S> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? (...args: A) => Promise<SentStabilioTransaction<S, StabilioReceipt<R, D>>>
    : never;
};

/**
 * Send Stabilio transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentStabilioTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @stabilio/lib-ethers#SendableEthersStabilio}.
 *
 * @public
 */
export interface SendableStabilio<R = unknown, S = unknown>
  extends _SendableFrom<TransactableStabilio, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableStabilio.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveCreationDetails>>>;

  /** {@inheritDoc TransactableStabilio.closeTrove} */
  closeTrove(): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveClosureDetails>>>;

  /** {@inheritDoc TransactableStabilio.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableStabilio.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableStabilio.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableStabilio.borrowXBRL} */
  borrowXBRL(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableStabilio.repayXBRL} */
  repayXBRL(
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>>;

  /** @internal */
  setPrice(price: Decimalish): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableStabilio.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableStabilio.depositXBRLInStabilityPool} */
  depositXBRLInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableStabilio.withdrawXBRLFromStabilityPool} */
  withdrawXBRLFromStabilityPool(
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableStabilio.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    SentStabilioTransaction<S, StabilioReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableStabilio.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    SentStabilioTransaction<S, StabilioReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableStabilio.sendXBRL} */
  sendXBRL(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.sendSTBL} */
  sendSTBL(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.redeemXBRL} */
  redeemXBRL(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableStabilio.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.stakeSTBL} */
  stakeSTBL(amount: Decimalish): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.unstakeSTBL} */
  unstakeSTBL(amount: Decimalish): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.approveXbrlWethUniTokens} */
  approveXbrlWethUniTokens(
    allowance?: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.stakeXbrlWethUniTokens} */
  stakeXbrlWethUniTokens(amount: Decimalish): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.unstakeXbrlWethUniTokens} */
  unstakeXbrlWethUniTokens(amount: Decimalish): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.withdrawSTBLRewardFromXbrlWethLiquidityMining} */
  withdrawSTBLRewardFromXbrlWethLiquidityMining(): Promise<
    SentStabilioTransaction<S, StabilioReceipt<R, void>>
  >;

  /** {@inheritDoc TransactableStabilio.exitXbrlWethLiquidityMining} */
  exitXbrlWethLiquidityMining(): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;

  /** {@inheritDoc TransactableStabilio.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<SentStabilioTransaction<S, StabilioReceipt<R, void>>>;
}
