import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRewards } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";

/** @alpha */
export interface ObservableLiquity {
  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void;

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRewards) => void,
    address?: string
  ): () => void;

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void;

  watchPrice(onPriceChanged: (price: Decimal) => void): () => void;

  watchTotal(onTotalChanged: (total: Trove) => void): () => void;

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address?: string
  ): () => void;

  watchLUSDInStabilityPool(
    onLUSDInStabilityPoolChanged: (lusdInStabilityPool: Decimal) => void
  ): () => void;

  watchLUSDBalance(onLUSDBalanceChanged: (balance: Decimal) => void, address?: string): () => void;
}
