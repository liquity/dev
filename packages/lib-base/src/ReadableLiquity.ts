import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRewards } from "./Trove";
import { StabilityDeposit } from "./StabilityDeposit";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";

/**
 * Represents whether an address has been registered as a Liquity frontend.
 *
 * @remarks
 * Returned by the {@link ReadableLiquity.getFrontendStatus | getFrontendStatus()} function.
 *
 * When `status` is `"registered"`, `kickbackRate` gives the frontend's kickback rate as a
 * {@link @liquity/decimal#Decimal} between 0 and 1.
 *
 * @public
 */
export type FrontendStatus =
  | { status: "unregistered" }
  | { status: "registered"; kickbackRate: Decimal };

/** @public */
export interface ReadableLiquity {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link TroveWithPendingRewards}.
   *
   * @example
   * See {@link ReadableLiquity.getLastTroves | getLastTroves()} for an example of how it's used.
   */
  getTotalRedistributed(): Promise<Trove>;

  getTroveWithoutRewards(address?: string): Promise<TroveWithPendingRewards>;

  getTrove(address?: string): Promise<Trove>;

  getNumberOfTroves(): Promise<number>;

  getPrice(): Promise<Decimal>;

  getTotal(): Promise<Trove>;

  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;

  getLUSDInStabilityPool(): Promise<Decimal>;

  getLUSDBalance(address?: string): Promise<Decimal>;

  getLQTYBalance(address?: string): Promise<Decimal>;

  getCollateralSurplusBalance(address?: string): Promise<Decimal>;

  getLastTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRewards][]>;

  getFirstTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRewards][]>;

  getFees(): Promise<Fees>;

  getLQTYStake(address?: string): Promise<LQTYStake>;

  getTotalStakedLQTY(): Promise<Decimal>;

  getFrontendStatus(address?: string): Promise<FrontendStatus>;
}
