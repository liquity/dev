import { Decimal, Decimalish } from "@liquity/decimal";

import { Trove, TroveChange } from "./Trove";
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

export interface HintedLiquity<TTransaction = unknown> extends TransactableLiquity<TTransaction> {
  openTrove(trove: Trove, optionalParams?: HintedTransactionOptionalParams): Promise<TTransaction>;

  depositEther(
    depositedEther: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<TTransaction>;

  withdrawEther(
    withdrawnEther: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<TTransaction>;

  borrowQui(
    borrowedQui: Decimalish,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<TTransaction>;

  repayQui(repaidQui: Decimalish, optionalParams?: TroveChangeOptionalParams): Promise<TTransaction>;

  changeTrove(
    change: TroveChange,
    optionalParams?: TroveChangeOptionalParams
  ): Promise<TTransaction>;

  transferCollateralGainToTrove(
    optionalParams?: StabilityDepositTransferOptionalParams
  ): Promise<TTransaction>;

  redeemCollateral(
    exchangedQui: Decimalish,
    optionalParams?: HintedTransactionOptionalParams
  ): Promise<TTransaction>;
}
