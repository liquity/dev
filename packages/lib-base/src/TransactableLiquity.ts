import { Decimal, Decimalish } from "@liquity/decimal";

import { proxify } from "./utils";
import { Trove, TroveAdjustment, TroveClosure, TroveCreation } from "./Trove";
import { StabilityDepositChange } from "./StabilityDeposit";

export type PopulatedLiquityTransaction<
  P = unknown,
  T extends SentLiquityTransaction = SentLiquityTransaction
> = {
  rawPopulatedTransaction: P;

  send(): Promise<T>;
};

export type SentLiquityTransaction<S = unknown, T extends LiquityReceipt = LiquityReceipt> = {
  rawSentTransaction: S;

  getReceipt(): Promise<T>;
  waitForReceipt(): Promise<Extract<T, MinedReceipt>>;
};

export type PendingReceipt = { status: "pending" };

export const pendingReceipt: PendingReceipt = { status: "pending" };

export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

export const failedReceipt = <R>(rawReceipt: R): FailedReceipt<R> => ({
  status: "failed",
  rawReceipt
});

export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

export const successfulReceipt = <R, D>(
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

export type TroveChangeWithFees<T> = {
  params: T;
  newTrove: Trove;
  fee: Decimal;
};

export type TroveCreationDetails = TroveChangeWithFees<TroveCreation<Decimal>>;
export type TroveAdjustmentDetails = TroveChangeWithFees<TroveAdjustment<Decimal>>;

export type TroveClosureDetails = {
  params: TroveClosure<Decimal>;
};

export type LiquidationDetails = {
  liquidatedAddresses: string[];

  totalLiquidated: Trove;
  lusdGasCompensation: Decimal;
  collateralGasCompensation: Decimal;
};

export type RedemptionDetails = {
  attemptedLUSDAmount: Decimal;
  actualLUSDAmount: Decimal;
  collateralReceived: Decimal;
  fee: Decimal;
};

export type StabilityPoolGainsWithdrawalDetails = {
  lusdLoss: Decimal;
  newLUSDDeposit: Decimal;
  collateralGain: Decimal;
  lqtyReward: Decimal;
};

export type StabilityDepositChangeDetails = StabilityPoolGainsWithdrawalDetails & {
  change: StabilityDepositChange<Decimal>;
};

export type CollateralGainTransferDetails = StabilityPoolGainsWithdrawalDetails & {
  newTrove: Trove;
};

export interface TransactableLiquity {
  openTrove(params: TroveCreation<Decimalish>): Promise<TroveCreationDetails>;
  closeTrove(): Promise<TroveClosureDetails>;

  depositCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  withdrawCollateral(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  borrowLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  repayLUSD(amount: Decimalish): Promise<TroveAdjustmentDetails>;
  adjustTrove(params: TroveAdjustment<Decimalish>): Promise<TroveAdjustmentDetails>;

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

export type SendMethod<A extends unknown[], T extends SentLiquityTransaction> = (
  ...args: A
) => Promise<T>;

export type Sendable<T, R = unknown, S = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? SendMethod<A, SentLiquityTransaction<S, LiquityReceipt<R, D>>>
    : never;
};

export type PopulateMethod<A extends unknown[], T extends PopulatedLiquityTransaction> = (
  ...args: A
) => Promise<T>;

export type Populatable<T, R = unknown, S = unknown, P = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? PopulateMethod<
        A,
        PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, D>>>
      >
    : never;
};

export type SendableFrom<T> = {
  [M in keyof T]: T[M] extends PopulateMethod<infer A, PopulatedLiquityTransaction<unknown, infer U>>
    ? SendMethod<A, U>
    : never;
};

export const sendableFrom = <T, U extends Populatable<T>>(
  Populatable: new (...args: never[]) => U
): new (populatable: U) => SendableFrom<U> => {
  const Sendable = class {
    _populatable: U;

    constructor(populatable: U) {
      this._populatable = populatable;
    }
  };

  proxify(
    Sendable,
    Populatable,
    method =>
      async function (...args) {
        return (await this._populatable[method].call(this._populatable, ...args)).send();
      }
  );

  return (Sendable as unknown) as new (populatable: U) => SendableFrom<U>;
};

export type TransactableFrom<T> = {
  [M in keyof T]: T[M] extends SendMethod<
    infer A,
    SentLiquityTransaction<unknown, LiquityReceipt<unknown, infer D>>
  >
    ? (...args: A) => Promise<D>
    : never;
};

export const transactableFrom = <T, U extends Sendable<T>>(
  Sendable: new (...args: never[]) => U
): new (sendable: U) => TransactableFrom<U> => {
  const Transactable = class {
    _sendable: U;

    constructor(sendable: U) {
      this._sendable = sendable;
    }
  };

  proxify(
    Transactable,
    Sendable,
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

  return (Transactable as unknown) as new (sendable: U) => TransactableFrom<U>;
};
