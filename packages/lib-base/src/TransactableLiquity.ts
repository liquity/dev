import { Decimal, Decimalish } from "@liquity/decimal";

import { proxify } from "./utils";
import { Trove, TroveChange } from "./Trove";

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

export type FailedReceipt<R = unknown> = { status: "failed"; rawReceipt: R };

export type SuccessfulReceipt<R = unknown, D = unknown> = {
  status: "succeeded";
  rawReceipt: R;
  details: D;
};

export type MinedReceipt<R = unknown, D = unknown> = FailedReceipt<R> | SuccessfulReceipt<R, D>;
export type LiquityReceipt<R = unknown, D = unknown> = PendingReceipt | MinedReceipt<R, D>;

export type LiquidationDetails = {
  fullyLiquidated: string[];
  partiallyLiquidated?: string;

  totalLiquidated: Trove;
  tokenGasCompensation: Decimal;
  collateralGasCompensation: Decimal;
};

export type RedemptionDetails = {
  attemptedTokenAmount: Decimal;
  actualTokenAmount: Decimal;
  collateralReceived: Decimal;
  fee: Decimal;
};

export interface TransactableLiquity {
  openTrove(trove: Trove): Promise<void>;
  closeTrove(): Promise<void>;

  depositEther(depositedEther: Decimalish): Promise<void>;
  withdrawEther(withdrawnEther: Decimalish): Promise<void>;
  borrowQui(borrowedQui: Decimalish): Promise<void>;
  repayQui(repaidQui: Decimalish): Promise<void>;
  changeTrove(change: TroveChange): Promise<void>;

  setPrice(price: Decimalish): Promise<void>;
  // updatePrice(): Promise<void>;

  liquidate(address: string): Promise<LiquidationDetails>;
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  depositQuiInStabilityPool(depositedQui: Decimalish, frontEndTag?: string): Promise<void>;
  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish): Promise<void>;
  transferCollateralGainToTrove(): Promise<void>;

  sendQui(toAddress: string, amount: Decimalish): Promise<void>;

  redeemCollateral(exchangedQui: Decimalish): Promise<RedemptionDetails>;
}

type SendMethod<A extends unknown[], D, R = unknown, S = unknown> = (
  ...args: A
) => Promise<SentLiquityTransaction<S, LiquityReceipt<R, D>>>;

export type Sendable<T, R = unknown, S = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? SendMethod<A, D, R, S>
    : never;
};

type PopulateMethod<A extends unknown[], D, R = unknown, S = unknown, P = unknown> = (
  ...args: A
) => Promise<PopulatedLiquityTransaction<P, SentLiquityTransaction<S, LiquityReceipt<R, D>>>>;

export type Populatable<T, R = unknown, S = unknown, P = unknown> = {
  [M in keyof T]: T[M] extends (...args: infer A) => Promise<infer D>
    ? PopulateMethod<A, D, R, S, P>
    : never;
};

type SendableFrom<T> = new (populatable: T) => {
  [M in keyof T]: T[M] extends PopulateMethod<infer A, infer D, infer R, infer S>
    ? SendMethod<A, D, R, S>
    : never;
};

export const sendableFrom = <T, U extends Populatable<T>>(
  Populatable: new (...args: never[]) => U
): SendableFrom<U> => {
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

  return (Sendable as unknown) as SendableFrom<U>;
};

type TransactableFrom<T> = new (sendable: T) => {
  [M in keyof T]: T[M] extends SendMethod<infer A, infer D> ? (...args: A) => Promise<D> : never;
};

export const transactableFrom = <T, U extends Sendable<T>>(
  Sendable: new (...args: never[]) => U
): TransactableFrom<U> => {
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

  return (Transactable as unknown) as TransactableFrom<U>;
};
