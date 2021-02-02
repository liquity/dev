import { Decimal } from "@liquity/decimal";

import { Trove, TroveWithPendingRedistribution } from "./Trove";
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

/**
 * Read the state of the Liquity protocol.
 *
 * @public
 */
export interface ReadableLiquity {
  /**
   * Get the total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link TroveWithPendingRedistribution}.
   *
   * @example
   * See {@link ReadableLiquity.getLastTroves | getLastTroves()} for an example of how it's used.
   */
  getTotalRedistributed(): Promise<Trove>;

  /**
   * Get a Trove in its state after the last direct modification.
   *
   * @param address - Address that owns the Trove.
   *
   * @remarks
   * The current state of a Trove can be fetched using {@link ReadableLiquity.getTrove | getTrove()}.
   */
  getTroveWithoutRewards(address?: string): Promise<TroveWithPendingRedistribution>;

  /**
   * Get the current state of a Trove.
   *
   * @param address - Address that owns the Trove.
   */
  getTrove(address?: string): Promise<Trove>;

  /**
   * Get number of Troves that are currently open.
   */
  getNumberOfTroves(): Promise<number>;

  /**
   * Get the current price of the native currency (e.g. Ether) in USD.
   */
  getPrice(): Promise<Decimal>;

  /**
   * Get the total amount of collateral and debt in the Liquity system.
   */
  getTotal(): Promise<Trove>;

  /**
   * Get the current state of a Stability Deposit.
   *
   * @param address - Address that owns the Stability Deposit.
   */
  getStabilityDeposit(address?: string): Promise<StabilityDeposit>;

  /**
   * Get the total amount of LUSD currently deposited in the Stability Pool.
   */
  getLUSDInStabilityPool(): Promise<Decimal>;

  /**
   * Get the amount of LUSD held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getLUSDBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of LQTY held by an address.
   *
   * @param address - Address whose balance should be retrieved.
   */
  getLQTYBalance(address?: string): Promise<Decimal>;

  /**
   * Get the amount of leftover collateral available for withdrawal by an address.
   *
   * @remarks
   * When a Trove gets liquidated or redeemed, any collateral it has above 110% (in case of
   * liquidation) or 100% collateralization (in case of redemption) gets sent to a pool, where it
   * can be withdrawn from using
   * {@link TransactableLiquity.claimCollateralSurplus | claimCollateralSurplus()}.
   */
  getCollateralSurplusBalance(address?: string): Promise<Decimal>;

  /**
   * Get a slice from the list of Troves sorted by collateral ratio in ascending order.
   *
   * @param startIdx - Index of first Trove to include from the sorted list.
   * @param numberOfTroves - The length of the slice.
   * @returns Pairs of owner addresses and their Troves.
   *
   * @example
   * The function returns Troves in the form of {@link TroveWithPendingRedistribution} objects,
   * which require further processing. For example:
   *
   * ```typescript
   * const trovesWithoutRedistribution = await liquity.getLastTroves(0, 10);
   * const totalRedistributed = await liquity.getTotalRedistributed();
   * const troves = trovesWithoutRedistribution.map(
   *   ([owner, t]) => [owner, t.applyRedistribution(totalRedistributed)]
   * );
   * ```
   */
  getLastTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRedistribution][]>;

  /**
   * Get a slice from the list of Troves sorted by collateral ratio in descending order.
   *
   * @param startIdx - Index of first Trove to include from the sorted list.
   * @param numberOfTroves - The length of the slice.
   * @returns Pairs of owner addresses and their Troves.
   *
   * @example
   * The function returns Troves in the form of {@link TroveWithPendingRedistribution} objects,
   * which require further processing. For an example, see
   * {@link ReadableLiquity.getLastTroves | getLastTroves()}
   */
  getFirstTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<[string, TroveWithPendingRedistribution][]>;

  /**
   * Get a calculator for current fees.
   */
  getFees(): Promise<Fees>;

  /**
   * Get the current state of an LQTY Stake.
   *
   * @param address - Address that owns the LQTY Stake.
   */
  getLQTYStake(address?: string): Promise<LQTYStake>;

  /**
   * Get the total amount of LQTY currently staked.
   */
  getTotalStakedLQTY(): Promise<Decimal>;

  /**
   * Check whether an address is registered as a Liquity frontend, and what its kickback rate is.
   *
   * @param address - Address to check.
   */
  getFrontendStatus(address?: string): Promise<FrontendStatus>;
}
