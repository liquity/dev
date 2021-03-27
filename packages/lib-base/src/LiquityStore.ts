import assert from "assert";

import { Decimal } from "./Decimal";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";
import { FrontendStatus } from "./ReadableLiquity";

/**
 * State variables read from the blockchain.
 *
 * @public
 */
export interface LiquityStoreBaseState {
  /** Status of currently used frontend. */
  frontend: FrontendStatus;

  /** Status of user's own frontend. */
  ownFrontend: FrontendStatus;

  /** Number of Troves that are currently open. */
  numberOfTroves: number;

  /** User's native currency balance (e.g. Ether). */
  accountBalance: Decimal;

  /** User's LUSD token balance. */
  lusdBalance: Decimal;

  /** User's LQTY token balance. */
  lqtyBalance: Decimal;

  /** User's Uniswap ETH/LUSD LP token balance. */
  uniTokenBalance: Decimal;

  /** The liquidity mining contract's allowance of user's Uniswap ETH/LUSD LP tokens. */
  uniTokenAllowance: Decimal;

  /** Remaining LQTY that will be collectively rewarded to liquidity miners. */
  remainingLiquidityMiningLQTYReward: Decimal;

  /** Amount of Uniswap ETH/LUSD LP tokens the user has staked in liquidity mining. */
  liquidityMiningStake: Decimal;

  /** Total amount of Uniswap ETH/LUSD LP tokens currently staked in liquidity mining. */
  totalStakedUniTokens: Decimal;

  /** Amount of LQTY the user has earned through mining liquidity. */
  liquidityMiningLQTYReward: Decimal;

  /**
   * Amount of leftover collateral available for withdrawal to the user.
   *
   * @remarks
   * See {@link ReadableLiquity.getCollateralSurplusBalance | getCollateralSurplusBalance()} for
   * more information.
   */
  collateralSurplusBalance: Decimal;

  /** Current price of the native currency (e.g. Ether) in USD. */
  price: Decimal;

  /** Total amount of LUSD currently deposited in the Stability Pool. */
  lusdInStabilityPool: Decimal;

  /** Total collateral and debt in the Liquity system. */
  total: Trove;

  /**
   * Total collateral and debt per stake that has been liquidated through redistribution.
   *
   * @remarks
   * Needed when dealing with instances of {@link TroveWithPendingRedistribution}.
   */
  totalRedistributed: Trove;

  /**
   * User's Trove in its state after the last direct modification.
   *
   * @remarks
   * The current state of the user's Trove can be found as
   * {@link LiquityStoreDerivedState.trove | trove}.
   */
  troveBeforeRedistribution: TroveWithPendingRedistribution;

  /** User's stability deposit. */
  stabilityDeposit: StabilityDeposit;

  /** Remaining LQTY that will be collectively rewarded to stability depositors. */
  remainingStabilityPoolLQTYReward: Decimal;

  /** @internal */
  _feesInNormalMode: Fees;

  /** User's LQTY stake. */
  lqtyStake: LQTYStake;

  /** Total amount of LQTY currently staked. */
  totalStakedLQTY: Decimal;

  /** @internal */
  _riskiestTroveBeforeRedistribution: TroveWithPendingRedistribution;
}

/**
 * State variables derived from {@link LiquityStoreBaseState}.
 *
 * @public
 */
export interface LiquityStoreDerivedState {
  /** Current state of user's Trove */
  trove: UserTrove;

  /** Calculator for current fees. */
  fees: Fees;

  /**
   * Current borrowing rate.
   *
   * @remarks
   * A value between 0 and 1.
   *
   * @example
   * For example a value of 0.01 amounts to a borrowing fee of 1% of the borrowed amount.
   */
  borrowingRate: Decimal;

  /**
   * Current redemption rate.
   *
   * @remarks
   * Note that the actual rate paid by a redemption transaction will depend on the amount of LUSD
   * being redeemed.
   *
   * Use {@link Fees.redemptionRate} to calculate a precise redemption rate.
   */
  redemptionRate: Decimal;

  /**
   * Whether there are any Troves with collateral ratio below the
   * {@link MINIMUM_COLLATERAL_RATIO | minimum}.
   */
  haveUndercollateralizedTroves: boolean;
}

/**
 * Type of {@link LiquityStore}'s {@link LiquityStore.state | state}.
 *
 * @remarks
 * It combines all properties of {@link LiquityStoreBaseState} and {@link LiquityStoreDerivedState}
 * with optional extra state added by the particular `LiquityStore` implementation.
 *
 * The type parameter `T` may be used to type the extra state.
 *
 * @public
 */
export type LiquityStoreState<T = unknown> = LiquityStoreBaseState & LiquityStoreDerivedState & T;

/**
 * Parameters passed to {@link LiquityStore} listeners.
 *
 * @remarks
 * Use the {@link LiquityStore.subscribe | subscribe()} function to register a listener.

 * @public
 */
export interface LiquityStoreListenerParams<T = unknown> {
  /** The entire previous state. */
  newState: LiquityStoreState<T>;

  /** The entire new state. */
  oldState: LiquityStoreState<T>;

  /** Only the state variables that have changed. */
  stateChange: Partial<LiquityStoreState<T>>;
}

const strictEquals = <T>(a: T, b: T) => a === b;
const eq = <T extends { eq(that: T): boolean }>(a: T, b: T) => a.eq(b);
const equals = <T extends { equals(that: T): boolean }>(a: T, b: T) => a.equals(b);

const frontendStatusEquals = (a: FrontendStatus, b: FrontendStatus) =>
  a.status === "unregistered"
    ? b.status === "unregistered"
    : b.status === "registered" && a.kickbackRate.eq(b.kickbackRate);

const showFrontendStatus = (x: FrontendStatus) =>
  x.status === "unregistered"
    ? '{ status: "unregistered" }'
    : `{ status: "registered", kickbackRate: ${x.kickbackRate} }`;

const wrap = <A extends unknown[], R>(f: (...args: A) => R) => (...args: A) => f(...args);

const difference = <T>(a: T, b: T) =>
  Object.fromEntries(
    Object.entries(a).filter(([key, value]) => value !== (b as Record<string, unknown>)[key])
  ) as Partial<T>;

/**
 * Abstract base class of Liquity data store implementations.
 *
 * @remarks
 * The type parameter `T` may be used to type extra state added to {@link LiquityStoreState} by the
 * subclass.
 *
 * Implemented by {@link @liquity/lib-ethers#BlockPolledLiquityStore}.
 *
 * @public
 */
export abstract class LiquityStore<T = unknown> {
  /** Turn console logging on/off. */
  logging = false;

  /**
   * Called after the state is fetched for the first time.
   *
   * @remarks
   * See {@link LiquityStore.start | start()}.
   */
  onLoaded?: () => void;

  /** @internal */
  protected _loaded = false;

  private _baseState?: LiquityStoreBaseState;
  private _derivedState?: LiquityStoreDerivedState;
  private _extraState?: T;

  private _updateTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private _listeners = new Set<(params: LiquityStoreListenerParams<T>) => void>();

  /**
   * The current store state.
   *
   * @remarks
   * Should not be accessed before the store is loaded. Assign a function to
   * {@link LiquityStore.onLoaded | onLoaded} to get a callback when this happens.
   *
   * See {@link LiquityStoreState} for the list of properties returned.
   */
  get state(): LiquityStoreState<T> {
    return Object.assign({}, this._baseState, this._derivedState, this._extraState);
  }

  /** @internal */
  protected abstract _doStart(): () => void;

  /**
   * Start monitoring the blockchain for Liquity state changes.
   *
   * @remarks
   * The {@link LiquityStore.onLoaded | onLoaded} callback will be called after the state is fetched
   * for the first time.
   *
   * Use the {@link LiquityStore.subscribe | subscribe()} function to register listeners.
   *
   * @returns Function to stop the monitoring.
   */
  start(): () => void {
    const doStop = this._doStart();

    return () => {
      doStop();

      this._cancelUpdateIfScheduled();
    };
  }

  private _cancelUpdateIfScheduled() {
    if (this._updateTimeoutId !== undefined) {
      clearTimeout(this._updateTimeoutId);
    }
  }

  private _scheduleUpdate() {
    this._cancelUpdateIfScheduled();

    this._updateTimeoutId = setTimeout(() => {
      this._updateTimeoutId = undefined;
      this._update();
    }, 30000);
  }

  private _logUpdate<U>(name: string, next: U, show?: (next: U) => string): U {
    if (this.logging) {
      console.log(`${name} updated to ${show ? show(next) : next}`);
    }

    return next;
  }

  private _updateIfChanged<U>(
    equals: (a: U, b: U) => boolean,
    name: string,
    prev: U,
    next?: U,
    show?: (next: U) => string
  ): U {
    return next !== undefined && !equals(prev, next) ? this._logUpdate(name, next, show) : prev;
  }

  private _silentlyUpdateIfChanged<U>(equals: (a: U, b: U) => boolean, prev: U, next?: U): U {
    return next !== undefined && !equals(prev, next) ? next : prev;
  }

  private _updateFees(name: string, prev: Fees, next?: Fees): Fees {
    if (next && !next.equals(prev)) {
      // Filter out fee update spam that happens on every new block by only logging when string
      // representation changes.
      if (`${next}` !== `${prev}`) {
        this._logUpdate(name, next);
      }
      return next;
    } else {
      return prev;
    }
  }

  private _reduce(
    baseState: LiquityStoreBaseState,
    baseStateUpdate: Partial<LiquityStoreBaseState>
  ): LiquityStoreBaseState {
    return {
      frontend: this._updateIfChanged(
        frontendStatusEquals,
        "frontend",
        baseState.frontend,
        baseStateUpdate.frontend,
        showFrontendStatus
      ),

      ownFrontend: this._updateIfChanged(
        frontendStatusEquals,
        "ownFrontend",
        baseState.ownFrontend,
        baseStateUpdate.ownFrontend,
        showFrontendStatus
      ),

      numberOfTroves: this._updateIfChanged(
        strictEquals,
        "numberOfTroves",
        baseState.numberOfTroves,
        baseStateUpdate.numberOfTroves
      ),

      accountBalance: this._updateIfChanged(
        eq,
        "accountBalance",
        baseState.accountBalance,
        baseStateUpdate.accountBalance
      ),

      lusdBalance: this._updateIfChanged(
        eq,
        "lusdBalance",
        baseState.lusdBalance,
        baseStateUpdate.lusdBalance
      ),

      lqtyBalance: this._updateIfChanged(
        eq,
        "lqtyBalance",
        baseState.lqtyBalance,
        baseStateUpdate.lqtyBalance
      ),

      uniTokenBalance: this._updateIfChanged(
        eq,
        "uniTokenBalance",
        baseState.uniTokenBalance,
        baseStateUpdate.uniTokenBalance
      ),

      uniTokenAllowance: this._updateIfChanged(
        eq,
        "uniTokenAllowance",
        baseState.uniTokenAllowance,
        baseStateUpdate.uniTokenAllowance
      ),

      remainingLiquidityMiningLQTYReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.remainingLiquidityMiningLQTYReward,
        baseStateUpdate.remainingLiquidityMiningLQTYReward
      ),

      liquidityMiningStake: this._updateIfChanged(
        eq,
        "liquidityMiningStake",
        baseState.liquidityMiningStake,
        baseStateUpdate.liquidityMiningStake
      ),

      totalStakedUniTokens: this._updateIfChanged(
        eq,
        "totalStakedUniTokens",
        baseState.totalStakedUniTokens,
        baseStateUpdate.totalStakedUniTokens
      ),

      liquidityMiningLQTYReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.liquidityMiningLQTYReward,
        baseStateUpdate.liquidityMiningLQTYReward
      ),

      collateralSurplusBalance: this._updateIfChanged(
        eq,
        "collateralSurplusBalance",
        baseState.collateralSurplusBalance,
        baseStateUpdate.collateralSurplusBalance
      ),

      price: this._updateIfChanged(eq, "price", baseState.price, baseStateUpdate.price),

      lusdInStabilityPool: this._updateIfChanged(
        eq,
        "lusdInStabilityPool",
        baseState.lusdInStabilityPool,
        baseStateUpdate.lusdInStabilityPool
      ),

      total: this._updateIfChanged(equals, "total", baseState.total, baseStateUpdate.total),

      totalRedistributed: this._updateIfChanged(
        equals,
        "totalRedistributed",
        baseState.totalRedistributed,
        baseStateUpdate.totalRedistributed
      ),

      troveBeforeRedistribution: this._updateIfChanged(
        equals,
        "troveBeforeRedistribution",
        baseState.troveBeforeRedistribution,
        baseStateUpdate.troveBeforeRedistribution
      ),

      stabilityDeposit: this._updateIfChanged(
        equals,
        "stabilityDeposit",
        baseState.stabilityDeposit,
        baseStateUpdate.stabilityDeposit
      ),

      remainingStabilityPoolLQTYReward: this._silentlyUpdateIfChanged(
        eq,
        baseState.remainingStabilityPoolLQTYReward,
        baseStateUpdate.remainingStabilityPoolLQTYReward
      ),

      _feesInNormalMode: this._silentlyUpdateIfChanged(
        equals,
        baseState._feesInNormalMode,
        baseStateUpdate._feesInNormalMode
      ),

      lqtyStake: this._updateIfChanged(
        equals,
        "lqtyStake",
        baseState.lqtyStake,
        baseStateUpdate.lqtyStake
      ),

      totalStakedLQTY: this._updateIfChanged(
        eq,
        "totalStakedLQTY",
        baseState.totalStakedLQTY,
        baseStateUpdate.totalStakedLQTY
      ),

      _riskiestTroveBeforeRedistribution: this._silentlyUpdateIfChanged(
        equals,
        baseState._riskiestTroveBeforeRedistribution,
        baseStateUpdate._riskiestTroveBeforeRedistribution
      )
    };
  }

  private _derive({
    troveBeforeRedistribution,
    totalRedistributed,
    _feesInNormalMode,
    total,
    price,
    _riskiestTroveBeforeRedistribution
  }: LiquityStoreBaseState): LiquityStoreDerivedState {
    const fees = _feesInNormalMode._setRecoveryMode(total.collateralRatioIsBelowCritical(price));

    return {
      trove: troveBeforeRedistribution.applyRedistribution(totalRedistributed),
      fees,
      borrowingRate: fees.borrowingRate(),
      redemptionRate: fees.redemptionRate(),
      haveUndercollateralizedTroves: _riskiestTroveBeforeRedistribution
        .applyRedistribution(totalRedistributed)
        .collateralRatioIsBelowMinimum(price)
    };
  }

  private _reduceDerived(
    derivedState: LiquityStoreDerivedState,
    derivedStateUpdate: LiquityStoreDerivedState
  ): LiquityStoreDerivedState {
    return {
      fees: this._updateFees("fees", derivedState.fees, derivedStateUpdate.fees),

      trove: this._updateIfChanged(equals, "trove", derivedState.trove, derivedStateUpdate.trove),

      borrowingRate: this._silentlyUpdateIfChanged(
        eq,
        derivedState.borrowingRate,
        derivedStateUpdate.borrowingRate
      ),

      redemptionRate: this._silentlyUpdateIfChanged(
        eq,
        derivedState.redemptionRate,
        derivedStateUpdate.redemptionRate
      ),

      haveUndercollateralizedTroves: this._updateIfChanged(
        strictEquals,
        "haveUndercollateralizedTroves",
        derivedState.haveUndercollateralizedTroves,
        derivedStateUpdate.haveUndercollateralizedTroves
      )
    };
  }

  /** @internal */
  protected abstract _reduceExtra(extraState: T, extraStateUpdate: Partial<T>): T;

  private _notify(params: LiquityStoreListenerParams<T>) {
    // Iterate on a copy of `_listeners`, to avoid notifying any new listeners subscribed by
    // existing listeners, as that could result in infinite loops.
    //
    // Before calling a listener from our copy of `_listeners`, check if it has been removed from
    // the original set. This way we avoid calling listeners that have already been unsubscribed
    // by an earlier listener callback.
    [...this._listeners].forEach(listener => {
      if (this._listeners.has(listener)) {
        listener(params);
      }
    });
  }

  /**
   * Register a state change listener.
   *
   * @param listener - Function that will be called whenever state changes.
   * @returns Function to unregister this listener.
   */
  subscribe(listener: (params: LiquityStoreListenerParams<T>) => void): () => void {
    const uniqueListener = wrap(listener);

    this._listeners.add(uniqueListener);

    return () => {
      this._listeners.delete(uniqueListener);
    };
  }

  /** @internal */
  protected _load(baseState: LiquityStoreBaseState, extraState?: T): void {
    assert(!this._loaded);

    this._baseState = baseState;
    this._derivedState = this._derive(baseState);
    this._extraState = extraState;
    this._loaded = true;

    this._scheduleUpdate();

    if (this.onLoaded) {
      this.onLoaded();
    }
  }

  /** @internal */
  protected _update(
    baseStateUpdate?: Partial<LiquityStoreBaseState>,
    extraStateUpdate?: Partial<T>
  ): void {
    assert(this._baseState && this._derivedState);

    const oldState = this.state;

    if (baseStateUpdate) {
      this._baseState = this._reduce(this._baseState, baseStateUpdate);
    }

    // Always running this lets us derive state based on passage of time, like baseRate decay
    this._derivedState = this._reduceDerived(this._derivedState, this._derive(this._baseState));

    if (extraStateUpdate) {
      assert(this._extraState);
      this._extraState = this._reduceExtra(this._extraState, extraStateUpdate);
    }

    this._scheduleUpdate();

    this._notify({
      newState: this.state,
      oldState,
      stateChange: difference(this.state, oldState)
    });
  }
}
