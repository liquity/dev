import { Decimal, Decimalish } from "@liquity/decimal";

import { Trove, TroveChange } from "./Trove";

export type PopulatedLiquityTransaction<
  T = unknown,
  U extends SentLiquityTransaction = SentLiquityTransaction
> = {
  rawTransaction: T;

  send(): Promise<U>;
};

export type SentLiquityTransaction<T = unknown, U extends LiquityReceipt = LiquityReceipt> = {
  rawTransaction: T;

  getReceipt(): Promise<U>;
  waitForReceipt(): Promise<Extract<U, MinedReceipt>>;
};

export type PendingReceipt = { status: "pending" };

export type FailedReceipt<T = unknown> = { status: "failed"; rawReceipt: T };

export type SuccessfulReceipt<T = unknown, U = unknown> = {
  status: "succeeded";
  rawReceipt: T;
  details: U;
};

export type MinedReceipt<T = unknown, U = unknown> = FailedReceipt<T> | SuccessfulReceipt<T, U>;
export type LiquityReceipt<T = unknown, U = unknown> = PendingReceipt | MinedReceipt<T, U>;

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
  updatePrice(): Promise<void>;

  liquidate(address: string): Promise<LiquidationDetails>;
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<LiquidationDetails>;

  depositQuiInStabilityPool(depositedQui: Decimalish, frontEndTag?: string): Promise<void>;
  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish): Promise<void>;
  transferCollateralGainToTrove(): Promise<void>;

  sendQui(toAddress: string, amount: Decimalish): Promise<void>;

  redeemCollateral(exchangedQui: Decimalish): Promise<RedemptionDetails>;
}

export type SendableLiquity<T, U> = {
  [P in keyof TransactableLiquity]: TransactableLiquity[P] extends (
    ...args: infer A
  ) => Promise<infer R>
    ? (...args: A) => Promise<SentLiquityTransaction<T, LiquityReceipt<U, R>>>
    : never;
};

export type PopulatableLiquity<T, U, V> = {
  [P in keyof SendableLiquity<U, V>]: SendableLiquity<U, V>[P] extends (
    ...args: infer A
  ) => Promise<SentLiquityTransaction<U, LiquityReceipt<V, infer R>>>
    ? (
        ...args: A
      ) => Promise<PopulatedLiquityTransaction<T, SentLiquityTransaction<U, LiquityReceipt<V, R>>>>
    : never;
};
