import { Decimal, Decimalish } from "@liquity/decimal";

import { proxify } from "./utils";
import { Trove, TroveAdjustmentParams, TroveClosureParams, TroveCreationParams } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";

export interface PopulatedLiquityTransaction<
  P = unknown,
  T extends SentLiquityTransaction = SentLiquityTransaction
> {
  rawPopulatedTransaction: P;

  send(): Promise<T>;
}

export interface SentLiquityTransaction<S = unknown, T extends LiquityReceipt = LiquityReceipt> {
  rawSentTransaction: S;

  getReceipt(): Promise<T>;
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
}

export type PendingReceipt = { status: "pending" };

/** @internal */
export const _pendingReceipt: PendingReceipt = { status: "pending" };

export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

/** @internal */
export const _failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

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

export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;
export type LiquityReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

export interface TroveCreationDetails {
  params: TroveCreationParams<Decimal>;
  newTrove: Trove;
  fee: Decimal;
}

export interface TroveAdjustmentDetails {
  params: TroveAdjustmentParams<Decimal>;
  newTrove: Trove;
  fee: Decimal;
}

export interface TroveClosureDetails {
  params: TroveClosureParams<Decimal>;
}

export interface LiquidationDetails {
  liquidatedAddresses: string[];

  totalLiquidated: Trove;
  lusdGasCompensation: Decimal;
  collateralGasCompensation: Decimal;
}

export interface RedemptionDetails {
  attemptedLUSDAmount: Decimal;
  actualLUSDAmount: Decimal;
  collateralReceived: Decimal;
  fee: Decimal;
}

export interface StabilityPoolGainsWithdrawalDetails {
  lusdLoss: Decimal;
  newLUSDDeposit: Decimal;
  collateralGain: Decimal;
  lqtyReward: Decimal;
}

export interface StabilityDepositChangeDetails extends StabilityPoolGainsWithdrawalDetails {
  change: StabilityDepositChange<Decimal>;
}

export interface CollateralGainTransferDetails extends StabilityPoolGainsWithdrawalDetails {
  newTrove: Trove;
}

export interface TransactableLiquity {
  /**
   * Open a new Trove.
   *
   * @returns The details of the Trove creation.
   */
  openTrove(params: TroveCreationParams<Decimalish>): Promise<TroveCreationDetails>;
  closeTrove(): Promise<TroveClosureDetails>;

  depositCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  withdrawCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  borrowLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  repayLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  adjustTrove(params: TroveAdjustmentParams<Decimalish>): Promise<TroveAdjustmentDetails>;

  /** @internal */
  setPrice(price: Decimalish): Promise<void>;

  liquidate(address: string): Promise<LiquidationDetails>;
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string
  ): Promise<StabilityDepositChangeDetails>;
  withdrawLUSDFromStabilityPool(amount: Decimalish): Promise<StabilityDepositChangeDetails>;
  withdrawGainsFromStabilityPool(): Promise<StabilityPoolGainsWithdrawalDetails>;
  transferCollateralGainToTrove(): Promise<CollateralGainTransferDetails>;

  sendLUSD(toAddress: string, amount: Decimalish): Promise<void>;
  sendLQTY(toAddress: string, amount: Decimalish): Promise<void>;

  redeemLUSD(amount: Decimalish): Promise<RedemptionDetails>;
  claimCollateralSurplus(): Promise<void>;

  stakeLQTY(amount: Decimalish): Promise<void>;
  unstakeLQTY(amount: Decimalish): Promise<void>;
  withdrawGainsFromStaking(): Promise<void>;

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
