import { Decimal } from "@liquity/decimal";

import { Trove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";

export type HintedTransactionOptionalParams = {
  price?: Decimal;
  numberOfTroves?: number;
};

export type TroveChangeOptionalParams = HintedTransactionOptionalParams & {
  trove?: Trove;
};

export type CollateralGainTransferOptionalParams = TroveChangeOptionalParams & {
  deposit?: StabilityDeposit;
};

type AddParams<T, K extends keyof T, U extends unknown[]> = {
  [P in K]: T[P] extends (...args: infer A) => infer R ? (...args: [...A, ...U]) => R : never;
};

type SimpleHintedMethod = "openTrove" | "redeemCollateral";
type TroveChangeMethod = "depositEther" | "withdrawEther" | "borrowQui" | "repayQui" | "changeTrove";
type CollateralGainTransferMethod = "transferCollateralGainToTrove";

type HintedMethod = SimpleHintedMethod | TroveChangeMethod | CollateralGainTransferMethod;
type Hintable = { [P in HintedMethod]: (...args: never[]) => unknown };

export type Hinted<T extends Hintable> = T &
  AddParams<T, SimpleHintedMethod, [optionalParams?: HintedTransactionOptionalParams]> &
  AddParams<T, TroveChangeMethod, [optionalParams?: TroveChangeOptionalParams]> &
  AddParams<
    T,
    CollateralGainTransferMethod,
    [optionalParams?: CollateralGainTransferOptionalParams]
  >;
