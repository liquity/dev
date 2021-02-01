import { Decimal, Decimalish } from "@liquity/decimal";

import { proxify } from "./utils";
import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#PopulatedEthersTransaction}.
 *
 * @public
 */
export interface PopulatedLiquityTransaction<
  P = unknown,
  T extends SentLiquityTransaction = SentLiquityTransaction
> {
  /** Implementation-specific populated transaction object. */
  rawPopulatedTransaction: P;

  /**
   * Send the transaction.
   *
   * @returns An object that implements {@link SentLiquityTransaction}.
   */
  send(): Promise<T>;
}

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Implemented by {@link @liquity/lib-ethers#SentEthersTransaction}.
 *
 * @public
 */
export interface SentLiquityTransaction<S = unknown, T extends LiquityReceipt = LiquityReceipt> {
  /** Implementation-specific sent transaction object. */
  rawSentTransaction: S;

  /**
   * Check whether the transaction has been mined, and whether it was successful.
   *
   * @returns A subtype of {@link LiquityReceipt}.
   *
   * @remarks
   * Unlike {@link SentLiquityTransaction.waitForReceipt | waitForReceipt()}, this function doesn't
   * wait for the transaction to be mined.
   */
  getReceipt(): Promise<T>;

  /**
   * Wait for the transaction to be mined, and check whether it was successful.
   *
   * @returns Either a {@link FailedReceipt} or a {@link SuccessfulReceipt}.
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
 * Indicates that the transaction has been mined, but it failed.
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

  /** Amount of LUSD paid as borrowing fee. */
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

  /** Amount of LUSD paid as borrowing fee. */
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

  /** Amount of native currency (e.g. Ether) received in exchange for the redeemed LUSD. */
  collateralReceived: Decimal;

  /** Amount of native currency (e.g. Ether) deducted as fee. */
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

export interface TransactableLiquity {
  /**
   * Open a new Trove by depositing collateral and borrowing LUSD.
   *
   * @param params - How much to deposit and borrow.
   */
  openTrove(params: TroveCreationParams<Decimalish>): Promise<TroveCreationDetails>;

  /**
   * Close existing Trove by repaying all debt and withdrawing all collateral.
   */
  closeTrove(): Promise<TroveClosureDetails>;

  /**
   * Adjust existing Trove by changing its collateral, debt, or both.
   *
   * @param params - Parameters of the adjustment.
   *
   * @remarks
   * The transaction will fail if the Trove's debt would fall below {@link LUSD_LIQUIDATION_RESERVE}.
   */
  adjustTrove(params: TroveAdjustmentParams<Decimalish>): Promise<TroveAdjustmentDetails>;

  /**
   * Adjust existing Trove by depositing more collateral.
   *
   * @param amount - The amount of collateral to add to the Trove's existing collateral.
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
   */
  liquidate(address: string | string[]): Promise<LiquidationDetails>;

  /**
   * Liquidate the least collateralized Troves up to a maximum number.
   *
   * @param maximumNumberOfTrovesToLiquidate - Stop after liquidating this many Troves.
   */
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  /**
   * Make a new Stability Deposit, or top up existing one.
   *
   * @param amount - Amount of LUSD to add to new or existing deposit.
   * @param frontendTag - Address that should receive a share of this deposit's LQTY rewards.
   *
   * @remarks
   * The `frontendTag` parameter is only effective when making a new deposit.
   *
   * As a side-effect, the transaction will also pay out an existing Stability Deposit's
   * {@link StabilityDeposit.collateralGain | collateral gain} and
   * {@link StabilityDeposit.lqtyReward | LQTY reward}.
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
   * @remarks
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link StabilityDeposit.collateralGain | collateral gain} and
   * {@link StabilityDeposit.lqtyReward | LQTY reward}.
   */
  withdrawLUSDFromStabilityPool(amount: Decimalish): Promise<StabilityDepositChangeDetails>;

  /**
   * Withdraw {@link StabilityDeposit.collateralGain | collateral gain} and
   * {@link StabilityDeposit.lqtyReward | LQTY reward} from Stability Deposit.
   */
  withdrawGainsFromStabilityPool(): Promise<StabilityPoolGainsWithdrawalDetails>;

  /**
   * Transfer {@link StabilityDeposit.collateralGain | collateral gain} from Stability Deposit to
   * Trove.
   *
   * @remarks
   * The collateral gain is transfered to the Trove as additional collateral.
   *
   * As a side-effect, the transaction will also pay out the Stability Deposit's
   * {@link StabilityDeposit.lqtyReward | LQTY reward}.
   */
  transferCollateralGainToTrove(): Promise<CollateralGainTransferDetails>;

  /**
   * Send LUSD tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of LUSD to send.
   */
  sendLUSD(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Send LQTY tokens to an address.
   *
   * @param toAddress - Address of receipient.
   * @param amount - Amount of LQTY to send.
   */
  sendLQTY(toAddress: string, amount: Decimalish): Promise<void>;

  /**
   * Redeem LUSD to native currency (e.g. Ether) at face value.
   *
   * @param amount - Amount of LUSD to be redeemed.
   */
  redeemLUSD(amount: Decimalish): Promise<RedemptionDetails>;

  /**
   * Claim leftover collateral after a liquidation or redemption.
   *
   * @remarks
   * Use {@link ReadableLiquity.getCollateralSurplusBalance | getCollateralSurplusBalance()} to
   * check the amount of collateral available for withdrawal.
   */
  claimCollateralSurplus(): Promise<void>;

  /**
   * Stake LQTY to start earning fee revenue or increase existing stake.
   *
   * @param amount - Amount of LQTY to add to new or existing stake.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out an existing LQTY stake's
   * {@link LQTYStake.collateralGain | collateral gain} and
   * {@link LQTYStake.lusdGain | LUSD gain}.
   */
  stakeLQTY(amount: Decimalish): Promise<void>;

  /**
   * Withdraw LQTY from staking.
   *
   * @param amount - Amount of LQTY to withdraw.
   *
   * @remarks
   * As a side-effect, the transaction will also pay out the LQTY stake's
   * {@link LQTYStake.collateralGain | collateral gain} and
   * {@link LQTYStake.lusdGain | LUSD gain}.
   */
  unstakeLQTY(amount: Decimalish): Promise<void>;

  /**
   * Withdraw {@link LQTYStake.collateralGain | collateral gain} and
   * {@link LQTYStake.lusdGain | LUSD gain} from LQTY stake.
   */
  withdrawGainsFromStaking(): Promise<void>;

  /**
   * Register current wallet address as a Liquity frontend.
   *
   * @param kickbackRate - The portion of LQTY rewards to pass onto users of the frontend
   *                       (between 0 and 1).
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
export const _sendableFrom = <T, U extends _Populatable<T>>(
  _Populatable: new (...args: never[]) => U
): new (populatable: U) => _SendableFrom<U> => {
  const _Sendable = class {
    _populatable: U;

    constructor(populatable: U) {
      this._populatable = populatable;
    }
  };

  proxify(
    _Sendable,
    _Populatable,
    method =>
      async function (...args) {
        return (await this._populatable[method].call(this._populatable, ...args)).send();
      }
  );

  return (_Sendable as unknown) as new (populatable: U) => _SendableFrom<U>;
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

/** @internal */
export const _transactableFrom = <T, U extends _Sendable<T>>(
  _Sendable: new (...args: never[]) => U
): new (sendable: U) => _TransactableFrom<U> => {
  const Transactable = class {
    _sendable: U;

    constructor(sendable: U) {
      this._sendable = sendable;
    }
  };

  proxify(
    Transactable,
    _Sendable,
    method =>
      async function (...args) {
        const tx = await this._sendable[method].call(this._sendable, ...args);
        const receipt = await tx.waitForReceipt();

        if (receipt.status !== "succeeded") {
          throw new Error("Transaction failed");
        }

        return receipt.details;
      }
  );

  return (Transactable as unknown) as new (sendable: U) => _TransactableFrom<U>;
};
