import { Decimal, Decimalish } from "@liquity/decimal";

import { Trove, TroveChange } from "./Trove";

export type LiquityTransaction<T = unknown, U extends LiquityReceipt = LiquityReceipt> = {
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

export type ParsedLiquidation = {
  fullyLiquidated: string[];
  partiallyLiquidated?: string;

  totalLiquidated: Trove;
  tokenGasCompensation: Decimal;
  collateralGasCompensation: Decimal;
};

export type ParsedRedemption = {
  attemptedTokenAmount: Decimal;
  actualTokenAmount: Decimal;
  collateralReceived: Decimal;
  fee: Decimal;
};

export type LiquidationReceipt<T = unknown> = LiquityReceipt<T, ParsedLiquidation>;
export type RedemptionReceipt<T = unknown> = LiquityReceipt<T, ParsedRedemption>;

export type SimpleTransaction<T, U> = LiquityTransaction<T, LiquityReceipt<U>>;
export type Liquidation<T, U> = LiquityTransaction<T, LiquidationReceipt<U>>;
export type Redemption<T, U> = LiquityTransaction<T, RedemptionReceipt<U>>;

export interface TransactableLiquity<T = unknown, U = unknown> {
  openTrove(trove: Trove): Promise<SimpleTransaction<T, U>>;
  closeTrove(): Promise<SimpleTransaction<T, U>>;

  depositEther(depositedEther: Decimalish): Promise<SimpleTransaction<T, U>>;
  withdrawEther(withdrawnEther: Decimalish): Promise<SimpleTransaction<T, U>>;
  borrowQui(borrowedQui: Decimalish): Promise<SimpleTransaction<T, U>>;
  repayQui(repaidQui: Decimalish): Promise<SimpleTransaction<T, U>>;
  changeTrove(change: TroveChange): Promise<SimpleTransaction<T, U>>;

  setPrice(price: Decimalish): Promise<SimpleTransaction<T, U>>;
  updatePrice(): Promise<SimpleTransaction<T, U>>;

  liquidate(address: string): Promise<Liquidation<T, U>>;
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<Liquidation<T, U>>;

  depositQuiInStabilityPool(
    depositedQui: Decimalish,
    frontEndTag?: string
  ): Promise<SimpleTransaction<T, U>>;
  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish): Promise<SimpleTransaction<T, U>>;
  transferCollateralGainToTrove(): Promise<SimpleTransaction<T, U>>;

  sendQui(toAddress: string, amount: Decimalish): Promise<SimpleTransaction<T, U>>;

  redeemCollateral(exchangedQui: Decimalish): Promise<Redemption<T, U>>;
}
