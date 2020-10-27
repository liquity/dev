import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRewards } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";

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

  watchQuiInStabilityPool(
    onQuiInStabilityPoolChanged: (quiInStabilityPool: Decimal) => void
  ): () => void;

  watchQuiBalance(onQuiBalanceChanged: (balance: Decimal) => void, address?: string): () => void;
}
