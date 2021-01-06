import assert from "assert";

import { Decimal } from "@liquity/decimal";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRewards } from "./Trove";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";

export type LiquityStoreBaseState = {
  numberOfTroves: number;
  accountBalance: Decimal;
  lusdBalance: Decimal;
  lqtyBalance: Decimal;
  collateralSurplusBalance: Decimal;
  price: Decimal;
  lusdInStabilityPool: Decimal;
  total: Trove;
  totalRedistributed: Trove;
  troveWithoutRewards: TroveWithPendingRewards;
  deposit: StabilityDeposit;
  fees: Fees;
  lqtyStake: LQTYStake;
  totalStakedLQTY: Decimal;
};

export type LiquityStoreDerivedState = {
  trove: Trove;
  borrowingFeeFactor: Decimal;
  redemptionFeeFactor: Decimal;
};

export type LiquityStoreState<T = unknown> = LiquityStoreBaseState & LiquityStoreDerivedState & T;

export type LiquityStoreListener<T = unknown> = (params: {
  newState: LiquityStoreState<T>;
  oldState: LiquityStoreState<T>;
  stateChange: Partial<LiquityStoreState<T>>;
}) => void;

const strictEquals = <T>(a: T, b: T) => a === b;
const eq = <T extends { eq(that: T): boolean }>(a: T, b: T) => a.eq(b);
const equals = <T extends { equals(that: T): boolean }>(a: T, b: T) => a.equals(b);

const wrap = <A extends unknown[], R>(f: (...args: A) => R) => (...args: A) => f(...args);

const difference = <T extends Record<string, unknown>>(a: T, b: T) =>
  Object.fromEntries(Object.entries(a).filter(([key, value]) => value !== b[key])) as Partial<T>;

export abstract class LiquityStore<T = unknown> {
  logging = true;
  onLoaded?: () => void;

  protected loaded = false;

  private baseState?: LiquityStoreBaseState;
  private derivedState?: LiquityStoreDerivedState;
  private extraState?: T;

  private updateTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<LiquityStoreListener<T>>();

  get state(): LiquityStoreState<T> {
    return Object.assign({}, this.baseState, this.derivedState, this.extraState);
  }

  abstract doStart(): () => void;

  start(): () => void {
    const doStop = this.doStart();

    return () => {
      doStop();

      this.cancelUpdateIfScheduled();
    };
  }

  private cancelUpdateIfScheduled() {
    if (this.updateTimeoutId !== undefined) {
      clearTimeout(this.updateTimeoutId);
    }
  }

  private scheduleUpdate() {
    this.cancelUpdateIfScheduled();

    this.updateTimeoutId = setTimeout(() => {
      this.updateTimeoutId = undefined;
      this.update();
    }, 30000);
  }

  protected logUpdate<U>(name: string, next: U): U {
    if (this.logging) {
      console.log(`${name} updated to ${next}`);
    }

    return next;
  }

  protected updateIfChanged<U>(equals: (a: U, b: U) => boolean, name: string, prev: U, next?: U): U {
    return next !== undefined && !equals(prev, next) ? this.logUpdate(name, next) : prev;
  }

  private reduce(
    baseState: LiquityStoreBaseState,
    baseStateUpdate: Partial<LiquityStoreBaseState>
  ): LiquityStoreBaseState {
    return {
      numberOfTroves: this.updateIfChanged(
        strictEquals,
        "numberOfTroves",
        baseState.numberOfTroves,
        baseStateUpdate.numberOfTroves
      ),

      accountBalance: this.updateIfChanged(
        eq,
        "accountBalance",
        baseState.accountBalance,
        baseStateUpdate.accountBalance
      ),

      lusdBalance: this.updateIfChanged(
        eq,
        "lusdBalance",
        baseState.lusdBalance,
        baseStateUpdate.lusdBalance
      ),

      lqtyBalance: this.updateIfChanged(
        eq,
        "lqtyBalance",
        baseState.lqtyBalance,
        baseStateUpdate.lqtyBalance
      ),

      collateralSurplusBalance: this.updateIfChanged(
        eq,
        "collateralSurplusBalance",
        baseState.collateralSurplusBalance,
        baseStateUpdate.collateralSurplusBalance
      ),

      price: this.updateIfChanged(eq, "price", baseState.price, baseStateUpdate.price),

      lusdInStabilityPool: this.updateIfChanged(
        eq,
        "lusdInStabilityPool",
        baseState.lusdInStabilityPool,
        baseStateUpdate.lusdInStabilityPool
      ),

      total: this.updateIfChanged(equals, "total", baseState.total, baseStateUpdate.total),

      totalRedistributed: this.updateIfChanged(
        equals,
        "totalRedistributed",
        baseState.totalRedistributed,
        baseStateUpdate.totalRedistributed
      ),

      troveWithoutRewards: this.updateIfChanged(
        equals,
        "troveWithoutRewards",
        baseState.troveWithoutRewards,
        baseStateUpdate.troveWithoutRewards
      ),

      deposit: this.updateIfChanged(equals, "deposit", baseState.deposit, baseStateUpdate.deposit),

      fees: this.updateIfChanged(equals, "fees", baseState.fees, baseStateUpdate.fees),

      lqtyStake: this.updateIfChanged(
        equals,
        "lqtyStake",
        baseState.lqtyStake,
        baseStateUpdate.lqtyStake
      ),

      totalStakedLQTY: this.updateIfChanged(
        eq,
        "totalStakedLQTY",
        baseState.totalStakedLQTY,
        baseStateUpdate.totalStakedLQTY
      )
    };
  }

  private derive({
    troveWithoutRewards,
    totalRedistributed,
    fees
  }: LiquityStoreBaseState): LiquityStoreDerivedState {
    return {
      trove: troveWithoutRewards.applyRewards(totalRedistributed),
      borrowingFeeFactor: fees.borrowingFeeFactor(),
      redemptionFeeFactor: fees.redemptionFeeFactor()
    };
  }

  private reduceDerived(
    derivedState: LiquityStoreDerivedState,
    derivedStateUpdate: LiquityStoreDerivedState
  ): LiquityStoreDerivedState {
    return {
      trove: this.updateIfChanged(equals, "trove", derivedState.trove, derivedStateUpdate.trove),

      borrowingFeeFactor: this.updateIfChanged(
        eq,
        "borrowingFeeFactor",
        derivedState.borrowingFeeFactor,
        derivedStateUpdate.borrowingFeeFactor
      ),

      redemptionFeeFactor: this.updateIfChanged(
        eq,
        "redemptionFeeFactor",
        derivedState.redemptionFeeFactor,
        derivedStateUpdate.redemptionFeeFactor
      )
    };
  }

  protected abstract reduceExtra(extraState: T, extraStateUpdate: Partial<T>): T;

  private notify(...args: Parameters<LiquityStoreListener<T>>) {
    [...this.listeners].forEach(listener => listener(...args));
  }

  subscribe(listener: LiquityStoreListener<T>): () => void {
    const uniqueListener = wrap(listener);

    this.listeners.add(uniqueListener);

    return () => {
      this.listeners.delete(uniqueListener);
    };
  }

  protected load(baseState: LiquityStoreBaseState, extraState?: T): void {
    assert(!this.loaded);

    this.baseState = baseState;
    this.derivedState = this.derive(baseState);
    this.extraState = extraState;
    this.loaded = true;

    this.scheduleUpdate();

    if (this.onLoaded) {
      this.onLoaded();
    }
  }

  protected update(
    baseStateUpdate?: Partial<LiquityStoreBaseState>,
    extraStateUpdate?: Partial<T>
  ): void {
    assert(this.baseState && this.derivedState);

    const oldState = this.state;

    if (baseStateUpdate) {
      this.baseState = this.reduce(this.baseState, baseStateUpdate);
    }

    // Always running this lets us derive state based on passage of time, like baseRate decay
    this.derivedState = this.reduceDerived(this.derivedState, this.derive(this.baseState));

    if (extraStateUpdate) {
      assert(this.extraState);
      this.extraState = this.reduceExtra(this.extraState, extraStateUpdate);
    }

    this.scheduleUpdate();

    this.notify({
      newState: this.state,
      oldState,
      stateChange: difference(this.state, oldState)
    });
  }
}
