import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRewards } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";

export interface ReadableLiquity {
  getTotalRedistributed(): Promise<Trove>;
  watchTotalRedistributed(onTotalRedistributedChanged: (totalRedistributed: Trove) => void): void;

  getTroveWithoutRewards(address?: string): Promise<TroveWithPendingRewards>;
  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRewards) => void,
    address?: string
  ): void;

  getTrove(address?: string): Promise<Trove>;

  getNumberOfTroves(): Promise<number>;
  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): void;

  getPrice(): Promise<Decimal>;
  watchPrice(onPriceChanged: (price: Decimal) => void): void;

  getTotal(): Promise<Trove>;
  watchTotal(onTotalChanged: (total: Trove) => void): void;

  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;
  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address?: string
  ): void;

  getQuiInStabilityPool(): Promise<Decimal>;
  watchQuiInStabilityPool(onQuiInStabilityPoolChanged: (quiInStabilityPool: Decimal) => void): void;

  getQuiBalance(address?: string): Promise<Decimal>;
  watchQuiBalance(onQuiBalanceChanged: (balance: Decimal) => void, address?: string): void;

  getLastTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<(readonly [string, TroveWithPendingRewards])[]>;

  getFirstTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<(readonly [string, TroveWithPendingRewards])[]>;
}
