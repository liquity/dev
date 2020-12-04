import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRewards } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";

export interface ReadableLiquity {
  getTotalRedistributed(): Promise<Trove>;

  getTroveWithoutRewards(address?: string): Promise<TroveWithPendingRewards>;

  getTrove(address?: string): Promise<Trove>;

  getNumberOfTroves(): Promise<number>;

  getPrice(): Promise<Decimal>;

  getTotal(): Promise<Trove>;

  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;

  getLUSDInStabilityPool(): Promise<Decimal>;

  getLUSDBalance(address?: string): Promise<Decimal>;

  getLastTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRewards][]>;

  getFirstTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRewards][]>;

  getFees(): Promise<Fees>;
}
