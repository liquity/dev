import { Decimal, Decimalish } from "@liquity/decimal";

import { Trove, TroveChange } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Redemption, SimpleTransaction, TransactableLiquity } from "./TransactableLiquity";

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

export interface HintedLiquity<T = unknown, U = unknown> extends TransactableLiquity<T, U> {
  openTrove(
    trove: Trove,
    optionalParams?: HintedTransactionOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  depositEther(
    depositedEther: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  withdrawEther(
    withdrawnEther: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  borrowQui(
    borrowedQui: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  repayQui(
    repaidQui: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  changeTrove(
    change: TroveChange,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  transferCollateralGainToTrove(
    optionalParams?: StabilityDepositTransferOptionalParams
  ): Promise<SimpleTransaction<T, U>>;

  redeemCollateral(
    exchangedQui: Decimalish,
    optionalParams?: HintedTransactionOptionalParams
  ): Promise<Redemption<T, U>>;
}
