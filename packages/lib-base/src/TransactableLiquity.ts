import { Decimal, Decimalish } from "@liquity/decimal";

import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";

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
 * Thrown by {@link TransactableLiquity} functions in case of transaction failure.
 *
 * @public
 */
export class TransactionFailedError<T extends FailedReceipt = FailedReceipt> extends Error {
  readonly failedReceipt: T;

  /** @internal */
  constructor(name: string, message: string, failedReceipt: T) {
    super(message);
    this.name = name;
    this.failedReceipt = failedReceipt;
  }
}

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#SentEthersLiquityTransaction}.
 *
 * @public
 */
export interface SentLiquityTransaction<S = unknown, T extends LiquityReceipt = LiquityReceipt> {
  /** Implementation-specific sent transaction object. */
  readonly rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @remarks
   * Unlike {@link @liquity/lib-base#SentLiquityTransaction.waitForReceipt | waitForReceipt()},
   * this function doesn't wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link @liquity/lib-base#FailedReceipt} or a
   *          {@link @liquity/lib-base#SuccessfulReceipt}.
   */
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

/**
 * Indicates that the transaction hasn't been mined yet.
 *
 * @remarks
 * Returned by {@link SentLiquityTransaction.getReceipt | SentLiquityTransaction.getReceipt()}
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
 * Returned by {@link SentLiquityTransaction.getReceipt | SentLiquityTransaction.getReceipt()} and
 * {@link SentLiquityTransaction.waitForReceipt | SentLiquityTransaction.waitForReceipt()}.
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
 * See the return types of {@link TransactableLiquity} functions for the exact contents of `details`
 * for each type of Liquity transaction.
 *
 * Returned by {@link SentLiquityTransaction.getReceipt | SentLiquityTransaction.getReceipt()} and
 * {@link SentLiquityTransaction.waitForReceipt | SentLiquityTransaction.waitForReceipt()}.
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
export type LiquityReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

/**
 * Details of an {@link TransactableLiquity.openTrove | openTrove()} transaction.
 *
 * @public
 */
export interface TroveCreationDetails {
  /** How much was deposited and borrowed. */
  params: TroveCreationParams<Decimal>;

  /** The Trove that was created by the transaction. */
  newTrove: Trove;

  /** Amount of LUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of an {@link TransactableLiquity.adjustTrove | adjustTrove()} transaction.
 *
 * @public
 */
export interface TroveAdjustmentDetails {
  /** Parameters of the adjustment. */
  params: TroveAdjustmentParams<Decimal>;

  /** New state of the adjusted Trove directly after the transaction. */
  newTrove: Trove;

  /** Amount of LUSD added to the Trove's debt as borrowing fee. */
  fee: Decimal;
}

/**
 * Details of a {@link TransactableLiquity.closeTrove | closeTrove()} transaction.
 *
 * @public
 */
export interface TroveClosureDetails {
  /** How much was withdrawn and repaid. */
  params: TroveClosureParams<Decimal>;
}

/**
 * Details of a {@link TransactableLiquity.liquidate | liquidate()} or
 * {@link TransactableLiquity.liquidateUpTo | liquidateUpTo()} transaction.
 *
 * @public
 */
export interface LiquidationDetails {
  /** Addresses whose Troves were liquidated by the transaction. */
  liquidatedAddresses: string[];

  /** Total collateral liquidated and debt cleared by the transaction. */
  totalLiquidated: Trove;

  /** Amount of LUSD paid to the liquidator as gas compensation. */
  lusdGasCompensation: Decimal;

  /** Amount of native currency (e.g. Ether) paid to the liquidator as gas compensation. */
  collateralGasCompensation: Decimal;
}

/**
 * Details of a {@link TransactableLiquity.redeemLUSD | redeemLUSD()} transaction.
 *
 * @public
 */
export interface RedemptionDetails {
  /** Amount of LUSD the redeemer tried to redeem. */
  attemptedLUSDAmount: Decimal;

  /**
   * Amount of LUSD that was actually redeemed by the transaction.
   *
   * @remarks
   * This can end up being lower than `attemptedLUSDAmount` due to interference from another
   * transaction that modifies the list of Troves.
   *
   * @public
   */
  actualLUSDAmount: Decimal;

  /** Amount of collateral (e.g. Ether) taken from Troves by the transaction. */
  collateralTaken: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee from collateral taken. */
  fee: Decimal;
}

/**
 * Details of a
 * {@link TransactableLiquity.withdrawGainsFromStabilityPool | withdrawGainsFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityPoolGainsWithdrawalDetails {
  /** Amount of LUSD burned from the deposit by liquidations since the last modification. */
  lusdLoss: Decimal;

  /** Amount of LUSD in the deposit directly after this transaction. */
  newLUSDDeposit: Decimal;

  /** Amount of native currency (e.g. Ether) paid out to the depositor in this transaction. */
  collateralGain: Decimal;

  /** Amount of LQTY rewarded to the depositor in this transaction. */
  lqtyReward: Decimal;
}

/**
 * Details of a
 * {@link TransactableLiquity.depositLUSDInStabilityPool | depositLUSDInStabilityPool()} or
 * {@link TransactableLiquity.withdrawLUSDFromStabilityPool | withdrawLUSDFromStabilityPool()}
 * transaction.
 *
 * @public
 */
export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  /** Change that was made to the deposit by this transaction. */
  change: StabilityDepositChange<Decimal>;
}

/**
 * Details of a
 * {@link TransactableLiquity.transferCollateralGainToTrove | transferCollateralGainToTrove()}
 * transaction.
 *
 * @public
 */
export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  /** New state of the depositor's Trove directly after the transaction. */
  newTrove: Trove;
}

/**
 * Send Liquity transactions and wait for them to succeed.
 *
 * @remarks
 * The functions return the details of the transaction (if any), or throw an implementation-specific
 * subclass of {@link TransactionFailedError} in case of transaction failure.
 *
 * Implemented by {@link @liquity/lib-ethers#EthersLiquity}.
 *
 * @public
 */
export interface TransactableLiquity {
  /**
   * Open a new Trove by depositing collateral and borrowing LUSD.
   *
   * @param params - How much to deposit and borrow.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  openTrove(params: TroveCreationParams<Decimalish>): Promise<TroveCreationDetails>;

  /**
   * Close existing Trove by repaying all debt and withdrawing all collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  closeTrove(): Promise<TroveClosureDetails>;

  /**
   * Adjust existing Trove by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The transaction will fail if the Trove's debt would fall below
   * {@link @liquity/lib-base#LUSD_LIQUIDATION_RESERVE}.
   */
  adjustTrove(params: TroveAdjustmentParams<Decimalish>): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Trove's existing collateral.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ depositCollateral: amount })
   * ```
   */
  depositCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by withdrawing some of its collateral.
   *
   * @param amount - The amount of collateral to withdraw from the Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ withdrawCollateral: amount })
   * ```
   */
  withdrawCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by borrowing more LUSD.
   *
   * @param amount - The amount of LUSD to borrow.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ borrowLUSD: amount })
   * ```
   */
  borrowLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by repaying some of its debt.
   *
   * @param amount - The amount of LUSD to repay.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * Equivalent to:
   *
   * ```typescript
   * adjustTrove({ repayLUSD: amount })
   * ```
   */
  repayLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;

  /** @internal */
  setPrice(price: Decimalish): Promise<void>;

  /**
   * Liquidate one or more undercollateralized Troves.
   *
   * @param address - Address or array of addresses whose Troves to liquidate.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidate(address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Troves up to a maximum number.
   *
   * @param maximumNumberOfTrovesToLiquidate - Stop after liquidating this many Troves.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of LUSD to add to new or existing deposit.
   * @param frontendTag - Address that should receive a share of this deposit's LQTY rewards.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The `frontendTag` parameter is only effective when making a new deposit.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.lqtyReward | LQTY reward}.
   */
  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw LUSD from Stability Deposit.
   *
   * @param amount - Amount of LUSD to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.lqtyReward | LQTY reward}.
   */
  withdrawLUSDFromStabilityPool(amount: Decimalish): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#StabilityDeposit.lqtyReward | LQTY reward} from Stability Deposit.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link @liquity/lib-base#StabilityDeposit.collateralGain | collateral gain} from
   * Stability Deposit to Trove.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * The collateral gain is transfered to the Trove as additional collateral.
   *
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link @liquity/lib-base#StabilityDeposit.lqtyReward | LQTY reward}.
   */
  transferCollateralGainToTrove(): Promise<CollateralGainTransferDetails>;

  /**
   * Send LUSD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of LUSD to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendLUSD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Send LQTY tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of LQTY to send.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  sendLQTY(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem LUSD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of LUSD to be redeemed.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  redeemLUSD(amount: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance | getCollateralSurplusBalance()}
   * to check the amount of collateral available for withdrawal.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(): Promise<void>;

  /**
   * Stake LQTY to start earning fee revenue or increase existing stake.
   *
   * @param amount - Amount of LQTY to add to new or existing stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out an existing LQTY stake's
   * {@link @liquity/lib-base#LQTYStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#LQTYStake.lusdGain | LUSD gain}.
   */
  stakeLQTY(amount: Decimalish): Promise<void>;

  /**
   * Withdraw LQTY from staking.
   *
   * @param amount - Amount of LQTY to withdraw.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the LQTY stake's
   * {@link @liquity/lib-base#LQTYStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#LQTYStake.lusdGain | LUSD gain}.
   */
  unstakeLQTY(amount: Decimalish): Promise<void>;

  /**
   * Withdraw {@link @liquity/lib-base#LQTYStake.collateralGain | collateral gain} and
   * {@link @liquity/lib-base#LQTYStake.lusdGain | LUSD gain} from LQTY stake.
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(): Promise<void>;

  /**
   * Register current wallet address as a Liquity frontend.
   *
   * @param kickbackRate - The portion of LQTY rewards to pass onto users of the frontend
   *                       (between 0 and 1).
   *
   * @throws
   * Throws {@link TransactionFailedError} in case of transaction failure.
   */
  registerFrontend(kickbackRate: Decimalish): Promise<void>;
}

/** @internal */
export type _SendMethod<A extends unknown[], T extends SentLiquityTransaction> = (
  ...args: A
) => Promise<T>;

/** @internal */
export type _Sendable<T, R = unknown, S = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? _SendMethod<A, SentLiquityTransaction<S, LiquityReceipt<R, D>>>
    : never;
};

/**
 * Send Liquity transactions.
 *
 * @remarks
 * The functions return an object implementing {@link SentLiquityTransaction}, which can be used
 * to monitor the transaction and get its details when it succeeds.
 *
 * Implemented by {@link @liquity/lib-ethers#SendableEthersLiquity}.
 *
 * @public
 */
export interface SendableLiquity<R = unknown, S = unknown>
  extends _Sendable<TransactableLiquity, R, S> {
  // Methods re-declared for documentation purposes

  /** {@inheritDoc TransactableLiquity.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveCreationDetails>>>;

  /** {@inheritDoc TransactableLiquity.closeTrove} */
  closeTrove(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveClosureDetails>>>;

  /** {@inheritDoc TransactableLiquity.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.borrowLUSD} */
  borrowLUSD(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** {@inheritDoc TransactableLiquity.repayLUSD} */
  repayLUSD(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, TroveAdjustmentDetails>>>;

  /** @internal */
  setPrice(price: Decimalish): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.liquidate} */
  liquidate(
    address: string | string[]
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableLiquity.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, LiquidationDetails>>>;

  /** {@inheritDoc TransactableLiquity.depositLUSDInStabilityPool} */
  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawLUSDFromStabilityPool} */
  withdrawLUSDFromStabilityPool(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, StabilityDepositChangeDetails>>>;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, StabilityPoolGainsWithdrawalDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(): Promise<
    SentLiquityTransaction<S, LiquityReceipt<R, CollateralGainTransferDetails>>
  >;

  /** {@inheritDoc TransactableLiquity.sendLUSD} */
  sendLUSD(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.sendLQTY} */
  sendLQTY(
    toAddress: string,
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.redeemLUSD} */
  redeemLUSD(
    amount: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, RedemptionDetails>>>;

  /** {@inheritDoc TransactableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.stakeLQTY} */
  stakeLQTY(amount: Decimalish): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.unstakeLQTY} */
  unstakeLQTY(amount: Decimalish): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;

  /** {@inheritDoc TransactableLiquity.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish
  ): Promise<SentLiquityTransaction<S, LiquityReceipt<R, void>>>;
}

/** @internal */
export type _PopulateMethod<A extends unknown[], T extends PopulatedLiquityTransaction> = (
  ...args: A
) => Promise<T>;

/** @internal */
export type _Populatable<T, R = unknown, S = unknown, P = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? _PopulateMethod<
        A,
        PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, D>>>
      >
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
  extends _Populatable<TransactableLiquity, R, S, P> {
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

/** @internal */
export type _SendableFrom<T> = {
  [M in keyof T]: T[M] extends _PopulateMethod<
    infer A,
    PopulatedLiquityTransaction<unknown, infer U>
  >
    ? _SendMethod<A, U>
    : never;
};

/** @internal */
export type _TransactableFrom<T> = {
  [M in keyof T]: T[M] extends _SendMethod<
    infer A,
    SentLiquityTransaction<unknown, LiquityReceipt<unknown, infer D>>
  >
    ? (...args: A) => Promise<D>
    : never;
};
