import { Decimal } from "@liquity/decimal";

import { Trove } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";

/** @internal */
export type _HintedMethodOptionalParams = {
  numberOfTroves?: number;
};

/** @internal */
export type _TroveCreationOptionalParams = _HintedMethodOptionalParams & {
  fees?: Fees;
};

/** @internal */
export type _FeelessTroveAdjustmentOptionalParams = _HintedMethodOptionalParams & {
  trove?: Trove;
};

/** @internal */
export type _TroveAdjustmentOptionalParams = _FeelessTroveAdjustmentOptionalParams & {
  fees?: Fees;
};

/** @internal */
export type _CollateralGainTransferOptionalParams = _FeelessTroveAdjustmentOptionalParams & {
  deposit?: StabilityDeposit;
};

/** @internal */
export type _RedemptionOptionalParams = _HintedMethodOptionalParams & {
  price?: Decimal;
  fees?: Fees;
  total?: Trove;
};

/** @internal */
export type _AddParams<T, K extends keyof T, U extends unknown[]> = {
  [P in K]: T[P] extends (...args: infer A) => infer R ? (...args: [...A, ...U]) => R : never;
};

/** @internal */ export type _TroveCreationMethod = "openTrove";
/** @internal */ export type _FeelessTroveAdjustmentMethod =
  | "depositCollateral"
  | "withdrawCollateral"
  | "repayLUSD";
/** @internal */ export type _TroveAdjustmentMethod = "borrowLUSD" | "adjustTrove";
/** @internal */ export type _CollateralGainTransferMethod = "transferCollateralGainToTrove";
/** @internal */ export type _RedemptionMethod = "redeemLUSD";

/** @internal */
export type _HintedMethod =
  | _TroveCreationMethod
  | _FeelessTroveAdjustmentMethod
  | _TroveAdjustmentMethod
  | _CollateralGainTransferMethod
  | _RedemptionMethod;

/** @internal */
export type _Hintable = { [P in _HintedMethod]: (...args: never[]) => unknown };

/** @internal */
export type _Hinted<T extends _Hintable> = T &
  _AddParams<T, _TroveCreationMethod, [optionalParams?: _TroveCreationOptionalParams]> &
  _AddParams<
    T,
    _FeelessTroveAdjustmentMethod,
    [optionalParams?: _FeelessTroveAdjustmentOptionalParams]
  > &
  _AddParams<T, _TroveAdjustmentMethod, [optionalParams?: _TroveAdjustmentOptionalParams]> &
  _AddParams<
    T,
    _CollateralGainTransferMethod,
    [optionalParams?: _CollateralGainTransferOptionalParams]
  > &
  _AddParams<T, _RedemptionMethod, [optionalParams?: _RedemptionOptionalParams]>;
