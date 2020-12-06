import { Decimal } from "@liquity/decimal";

import { Trove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";

export type HintedTransactionOptionalParams = {
  price?: Decimal;
  numberOfTroves?: number;
};

export type TroveAdjustmentOptionalParams = HintedTransactionOptionalParams & {
  trove?: Trove;
};

export type CollateralGainTransferOptionalParams = TroveAdjustmentOptionalParams & {
  deposit?: StabilityDeposit;
};

type AddParams<T, K extends keyof T, U extends unknown[]> = {
  [P in K]: T[P] extends (...args: infer A) => infer R ? (...args: [...A, ...U]) => R : never;
};

type SimpleHintedMethod = "openTrove" | "redeemLUSD";
type TroveAdjustmentMethod =
  | "depositCollateral"
  | "withdrawCollateral"
  | "borrowLUSD"
  | "repayLUSD"
  | "adjustTrove";
type CollateralGainTransferMethod = "transferCollateralGainToTrove";

type HintedMethod = SimpleHintedMethod | TroveAdjustmentMethod | CollateralGainTransferMethod;
type Hintable = { [P in HintedMethod]: (...args: never[]) => unknown };

export type Hinted<T extends Hintable> = T &
  AddParams<T, SimpleHintedMethod, [optionalParams?: HintedTransactionOptionalParams]> &
  AddParams<T, TroveAdjustmentMethod, [optionalParams?: TroveAdjustmentOptionalParams]> &
  AddParams<
    T,
    CollateralGainTransferMethod,
    [optionalParams?: CollateralGainTransferOptionalParams]
  >;
