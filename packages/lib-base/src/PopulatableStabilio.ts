import { Decimal, Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";
import { StabilioReceipt, SendableStabilio, SentStabilioTransaction } from "./SendableStabilio";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableStabilio";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @stabilio/lib-ethers#PopulatedEthersStabilioTransaction}.
 *
 * @public
 */
export interface PopulatedStabilioTransaction<
  P = unknown,
  T extends SentStabilioTransaction = SentStabilioTransaction
> {
  /** Implementation-specific populated transaction object. */
  readonly rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link @stabilio/lib-base#SentStabilioTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A redemption transaction that has been prepared for sending.
 *
 * @remarks
 * The Stabilio protocol fulfills redemptions by repaying the debt of Troves in ascending order of
 * their collateralization ratio, and taking a portion of their collateral in exchange. Due to the
 * {@link @stabilio/lib-base#XBRL_MINIMUM_DEBT | minimum debt} requirement that Troves must fulfill,
 * some XBRL amounts are not possible to redeem exactly.
 *
 * When {@link @stabilio/lib-base#PopulatableStabilio.redeemXBRL | redeemXBRL()} is called with an
 * amount that can't be fully redeemed, the amount will be truncated (see the `redeemableXBRLAmount`
 * property). When this happens, the redeemer can either redeem the truncated amount by sending the
 * transaction unchanged, or prepare a new transaction by
 * {@link @stabilio/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt | increasing the amount}
 * to the next lowest possible value, which is the sum of the truncated amount and
 * {@link @stabilio/lib-base#XBRL_MINIMUM_NET_DEBT}.
 *
 * @public
 */
export interface PopulatedRedemption<P = unknown, S = unknown, R = unknown>
  extends PopulatedStabilioTransaction<
    P,
    SentStabilioTransaction<S, StabilioReceipt<R, RedemptionDetails>>
  > {
  /** Amount of XBRL the redeemer is trying to redeem. */
  readonly attemptedXBRLAmount: Decimal;

  /** Maximum amount of XBRL that is currently redeemable from `attemptedXBRLAmount`. */
  readonly redeemableXBRLAmount: Decimal;

  /** Whether `redeemableXBRLAmount` is less than `attemptedXBRLAmount`. */
  readonly isTruncated: boolean;

  /**
   * Prepare a new transaction by increasing the attempted amount to the next lowest redeemable
   * value.
   *
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @stabilio/lib-base#Fees.redemptionRate | redemption rate} to
   *                            use in the new transaction.
   *
   * @remarks
   * If `maxRedemptionRate` is omitted, the original transaction's `maxRedemptionRate` is reused
   * unless that was also omitted, in which case the current redemption rate (based on the increased
   * amount) plus 0.1% is used as maximum acceptable rate.
   */
  increaseAmountByMinimumNetDebt(
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;
}

/** @internal */
export type _PopulatableFrom<T, P> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer U>
    ? U extends SentStabilioTransaction
      ? (...args: A) => Promise<PopulatedStabilioTransaction<P, U>>
      : never
    : never;
};

/**
 * Prepare Stabilio transactions for sending.
 *
 * @remarks
 * The functions return an object implementing {@link PopulatedStabilioTransaction}, which can be
 * used to send the transaction and get a {@link SentStabilioTransaction}.
 *
 * Implemented by {@link @stabilio/lib-ethers#PopulatableEthersStabilio}.
 *
 * @public
 */
export interface PopulatableStabilio<R = unknown, S = unknown, P = unknown>
  extends _PopulatableFrom<SendableStabilio<R, S>, P> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableStabilio.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveCreationDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.closeTrove} */
  closeTrove(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, TroveClosureDetails>>>
  >;

  /** {@inheritDoc TransactableStabilio.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.borrowXBRL} */
  borrowXBRL(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.repayXBRL} */
  repayXBRL(
    amount: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** @internal */
  setPrice(
    price: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableStabilio.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableStabilio.depositXBRLInStabilityPool} */
  depositXBRLInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.withdrawXBRLFromStabilityPool} */
  withdrawXBRLFromStabilityPool(
    amount: Decimalish
  ): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, StabilityPoolGainsWithdrawalDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    PopulatedStabilioTransaction<
      P,
      SentStabilioTransaction<S, StabilioReceipt<R, CollateralGainTransferDetails>>
    >
  >;

  /** {@inheritDoc TransactableStabilio.sendXBRL} */
  sendXBRL(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.sendSTBL} */
  sendSTBL(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.redeemXBRL} */
  redeemXBRL(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;

  /** {@inheritDoc TransactableStabilio.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.stakeSTBL} */
  stakeSTBL(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.unstakeSTBL} */
  unstakeSTBL(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.approveXbrlStblUniTokens} */
  approveXbrlStblUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.stakeXbrlStblUniTokens} */
  stakeXbrlStblUniTokens(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.unstakeXbrlStblUniTokens} */
  unstakeXbrlStblUniTokens(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.withdrawSTBLRewardFromXbrlStblLiquidityMining} */
  withdrawSTBLRewardFromXbrlStblLiquidityMining(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.exitXbrlStblLiquidityMining} */
  exitXbrlStblLiquidityMining(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.approveXbrlStblUniTokens} */
  approveXbrlWethUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.stakeXbrlWethUniTokens} */
  stakeXbrlWethUniTokens(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.unstakeXbrlWethUniTokens} */
  unstakeXbrlWethUniTokens(
    amount: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;

  /** {@inheritDoc TransactableStabilio.withdrawSTBLRewardFromXbrlWethLiquidityMining} */
  withdrawSTBLRewardFromXbrlWethLiquidityMining(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.exitXbrlWethLiquidityMining} */
  exitXbrlWethLiquidityMining(): Promise<
    PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableStabilio.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<PopulatedStabilioTransaction<P, SentStabilioTransaction<S, StabilioReceipt<R, void>>>>;
}
