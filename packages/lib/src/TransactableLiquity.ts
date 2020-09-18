import { Decimalish } from "@liquity/decimal";

import { Trove, TroveChange } from "./Trove";
import { ReadableLiquity } from "./ReadableLiquity";

export interface TransactableLiquity<TTransaction = unknown> extends ReadableLiquity {
  openTrove(trove: Trove): Promise<TTransaction>;
  closeTrove(): Promise<TTransaction>;

  depositEther(depositedEther: Decimalish): Promise<TTransaction>;
  withdrawEther(withdrawnEther: Decimalish): Promise<TTransaction>;
  borrowQui(borrowedQui: Decimalish): Promise<TTransaction>;
  repayQui(repaidQui: Decimalish): Promise<TTransaction>;
  changeTrove(change: TroveChange): Promise<TTransaction>;

  setPrice(price: Decimalish): Promise<TTransaction>;
  updatePrice(): Promise<TTransaction>;

  liquidate(address: string): Promise<TTransaction>;
  liquidateUpTo(maximumNumberOfTrovesToLiquidate: number): Promise<TTransaction>;

  depositQuiInStabilityPool(depositedQui: Decimalish): Promise<TTransaction>;
  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish): Promise<TTransaction>;
  transferCollateralGainToTrove(): Promise<TTransaction>;

  sendQui(toAddress: string, amount: Decimalish): Promise<TTransaction>;

  redeemCollateral(exchangedQui: Decimalish): Promise<TTransaction>;
}
