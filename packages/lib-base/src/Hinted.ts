import { Decimal } from "@liquity/decimal";

import { Trove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";

export type HintedMethodOptionalParams = {
  numberOfTroves?: number;
};

export type TroveCreationOptionalParams = HintedMethodOptionalParams & {
  fees?: Fees;
};

export type FeelessTroveAdjustmentOptionalParams = HintedMethodOptionalParams & {
  trove?: Trove;
};

export type TroveAdjustmentOptionalParams = FeelessTroveAdjustmentOptionalParams & {
  fees?: Fees;
};

export type CollateralGainTransferOptionalParams = FeelessTroveAdjustmentOptionalParams & {
  deposit?: StabilityDeposit;
};

export type RedemptionOptionalParams = HintedMethodOptionalParams & {
  price?: Decimal;
};

type AddParams<T, K extends keyof T, U extends unknown[]> = {
  [P in K]: T[P] extends (...args: infer A) => infer R ? (...args: [...A, ...U]) => R : never;
};

type TroveCreationMethod = "openTrove";
type FeelessTroveAdjustmentMethod = "depositCollateral" | "withdrawCollateral" | "repayLUSD";
type TroveAdjustmentMethod = "borrowLUSD" | "adjustTrove";
type CollateralGainTransferMethod = "transferCollateralGainToTrove";
type RedemptionMethod = "redeemLUSD";

type HintedMethod =
  | TroveCreationMethod
  | FeelessTroveAdjustmentMethod
  | TroveAdjustmentMethod
  | CollateralGainTransferMethod
  | RedemptionMethod;

type Hintable = { [P in HintedMethod]: (...args: never[]) => unknown };

export type Hinted<T extends Hintable> = T &
  AddParams<T, TroveCreationMethod, [optionalParams?: TroveCreationOptionalParams]> &
  AddParams<
    T,
    FeelessTroveAdjustmentMethod,
    [optionalParams?: FeelessTroveAdjustmentOptionalParams]
  > &
  AddParams<T, TroveAdjustmentMethod, [optionalParams?: TroveAdjustmentOptionalParams]> &
  AddParams<
    T,
    CollateralGainTransferMethod,
    [optionalParams?: CollateralGainTransferOptionalParams]
  > &
  AddParams<T, RedemptionMethod, [optionalParams?: RedemptionOptionalParams]>;
