import { Decimalish } from "./Decimal";
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
    params: TroveCreationParams<Decimalish>
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
    params: TroveAdjustmentParams<Decimalish>
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
    amount: Decimalish
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
    amount: Decimalish
  ): Promise<
    PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, RedemptionDetails>>>
  >;

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

  /** {@inheritDoc TransactableLiquity.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, void>>>>;
}
