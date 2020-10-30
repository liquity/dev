import { Decimal } from "@liquity/decimal";

import { Trove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { TransactableLiquity } from "./TransactableLiquity";

export type HintedTransactionOptionalParams = {
  price?: Decimal;
  numberOfTroves?: number;
};

export type TroveChangeOptionalParams = HintedTransactionOptionalParams & {
  trove?: Trove;
};

export type StabilityDepositTransferOptionalParams = TroveChangeOptionalParams & {
  deposit?: StabilityDeposit;
};

type AddParams<T, K extends keyof T, U extends unknown[]> = {
  [P in K]: T[P] extends (...args: infer A) => infer R ? (...args: [...A, ...U]) => R : never;
};

type SimpleHintedMethod = "openTrove" | "redeemCollateral";
type TroveChangeMethod = "depositEther" | "withdrawEther" | "borrowQui" | "repayQui" | "changeTrove";

type AddHintParams<T extends TransactableLiquity> = T &
  AddParams<T, SimpleHintedMethod, [optionalParams?: HintedTransactionOptionalParams]> &
  AddParams<T, TroveChangeMethod, [optionalParams?: TroveChangeOptionalParams]> &
  AddParams<
    T,
    "transferCollateralGainToTrove",
    [optionalParams?: StabilityDepositTransferOptionalParams]
  >;

export type HintedLiquity<T, U> = AddHintParams<TransactableLiquity<T, U>>;
