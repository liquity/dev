import { Decimal, Decimalish } from "./Decimal";
import { TroveAdjustmentParams, TroveCreationParams } from "./Trove";
import { LiquityReceipt, SendableLiquity, SentLiquityTransaction } from "./SendableLiquity";

import {
  CollateralGainTransferDetails,
  LiquidationDetails,
  RedemptionDetails,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveClosureDetails,
  TroveCreationDetails
} from "./TransactableLiquity";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#PopulatedEthersLiquityTransaction}.
 *
 * @public
 */
export interface PopulatedLiquityTransaction<
  P = unknown,
  T extends SentLiquityTransaction = SentLiquityTransaction
> {
  /** Implementation-specific populated transaction object. */
  readonly rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link @liquity/lib-base#SentLiquityTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A redemption transaction that has been prepared for sending.
 *
 * @remarks
 * The Liquity protocol fulfills redemptions by repaying the debt of Troves in ascending order of
 * their collateralization ratio, and taking a portion of their collateral in exchange. Due to the
 * {@link @liquity/lib-base#LUSD_MINIMUM_DEBT | minimum debt} requirement that Troves must fulfill,
 * some LUSD amounts are not possible to redeem exactly.
 *
 * When {@link @liquity/lib-base#PopulatableLiquity.redeemLUSD | redeemLUSD()} is called with an
 * amount that can't be fully redeemed, the amount will be truncated (see the `redeemableLUSDAmount`
 * property). When this happens, the redeemer can either redeem the truncated amount by sending the
 * transaction unchanged, or prepare a new transaction by
 * {@link @liquity/lib-base#PopulatedRedemption.increaseAmountByMinimumNetDebt | increasing the amount}
 * to the next lowest possible value, which is the sum of the truncated amount and
 * {@link @liquity/lib-base#LUSD_MINIMUM_NET_DEBT}.
 *
 * @public
 */
export interface PopulatedRedemption<P = unknown, S = unknown, R = unknown>
  extends PopulatedLiquityTransaction<
    P,
    SentLiquityTransaction<S, LiquityReceipt<R, RedemptionDetails>>
  > {
  /** Amount of LUSD the redeemer is trying to redeem. */
  readonly attemptedLUSDAmount: Decimal;

  /** Maximum amount of LUSD that is currently redeemable from `attemptedLUSDAmount`. */
  readonly redeemableLUSDAmount: Decimal;

  /** Whether `redeemableLUSDAmount` is less than `attemptedLUSDAmount`. */
  readonly isTruncated: boolean;

  /**
   * Prepare a new transaction by increasing the attempted amount to the next lowest redeemable
   * value.
   *
   * @param maxRedemptionRate - Maximum acceptable
   *                            {@link @liquity/lib-base#Fees.redemptionRate | redemption rate} to
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
    ? U extends SentLiquityTransaction
      ? (...args: A) => Promise<PopulatedLiquityTransaction<P, U>>
      : never
    : never;
};

/**
 * Prepare Liquity transactions for sending.
 *
 * @remarks
 * The functions return an object implementing {@link PopulatedLiquityTransaction}, which can be
 * used to send the transaction and get a {@link SentLiquityTransaction}.
 *
 * Implemented by {@link @liquity/lib-ethers#PopulatableEthersLiquity}.
 *
 * @public
 */
export interface PopulatableLiquity<R = unknown, S = unknown, P = unknown>
  extends _PopulatableFrom<SendableLiquity<R, S>, P> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableLiquity.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveCreationDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.closeTrove} */
  closeTrove(): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, TroveClosureDetails>>>
  >;

  /** {@inheritDoc TransactableLiquity.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.borrowLUSD} */
  borrowLUSD(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.repayLUSD} */
  repayLUSD(
    amount: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>
    >
  >;

  /** @internal */
  setPrice(
    price: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableLiquity.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>
  >;

  /** {@inheritDoc TransactableLiquity.depositLUSDInStabilityPool} */
  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.withdrawLUSDFromStabilityPool} */
  withdrawLUSDFromStabilityPool(
    amount: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, StabilityPoolGainsWithdrawalDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    PopulatedLiquityTransaction<
      P,
      SentLiquityTransaction<S, LiquityReceipt<R, CollateralGainTransferDetails>>
    >
  >;

  /** {@inheritDoc TransactableLiquity.sendLUSD} */
  sendLUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.sendLQTY} */
  sendLQTY(
    toAddress: string,
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.redeemLUSD} */
  redeemLUSD(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish
  ): Promise<PopulatedRedemption<P, S, R>>;

  /** {@inheritDoc TransactableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableLiquity.stakeLQTY} */
  stakeLQTY(
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.unstakeLQTY} */
  unstakeLQTY(
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableLiquity.approveUniTokens} */
  approveUniTokens(
    allowance?: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.stakeUniTokens} */
  stakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.unstakeUniTokens} */
  unstakeUniTokens(
    amount: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;

  /** {@inheritDoc TransactableLiquity.withdrawLQTYRewardFromLiquidityMining} */
  withdrawLQTYRewardFromLiquidityMining(): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableLiquity.exitLiquidityMining} */
  exitLiquidityMining(): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>
  >;

  /** {@inheritDoc TransactableLiquity.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;
}
