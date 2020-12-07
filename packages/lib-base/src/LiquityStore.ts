import assert from "assert";

import { Decimal } from "@liquity/decimal";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRewards } from "./Trove";

export type LiquityStoreBaseState = {
  numberOfTroves: number;
  accountBalance: Decimal;
  lusdBalance: Decimal;
  price: Decimal;
  lusdInStabilityPool: Decimal;
  total: Trove;
  totalRedistributed: Trove;
  troveWithoutRewards: TroveWithPendingRewards;
  deposit: StabilityDeposit;
};

export type LiquityStoreDerivedState = {
  trove: Trove;
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

const asserted = <T>(x?: T): T => {
  assert(x);
  return x;
};

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

  private listeners = new Set<LiquityStoreListener<T>>();

  get state(): LiquityStoreState<T> {
    return Object.assign({}, this.baseState, this.derivedState, this.extraState);
  }

  abstract start(): () => void;

  protected logUpdate<U>(name: string, next: U): U {
    if (this.logging) {
      console.log(`${name} updated to ${next}`);
    }

    return next;
  }

  protected updateIfChanged<U>(equals: (a: U, b: U) => boolean, name: string, prev: U, next?: U): U {
    return next !== undefined && !equals(prev, next) ? this.logUpdate(name, next) : prev;
  }

  private reduce({
    numberOfTroves,
    accountBalance,
    lusdBalance,
    price,
    lusdInStabilityPool,
    total,
    totalRedistributed,
    troveWithoutRewards,
    deposit
  }: Partial<LiquityStoreBaseState>): LiquityStoreBaseState {
    assert(this.baseState);

    return {
      numberOfTroves: this.updateIfChanged(
        strictEquals,
        "numberOfTroves",
        this.baseState.numberOfTroves,
        numberOfTroves
      ),

      accountBalance: this.updateIfChanged(
        eq,
        "accountBalance",
        this.baseState.accountBalance,
        accountBalance
      ),

      lusdBalance: this.updateIfChanged(eq, "lusdBalance", this.baseState.lusdBalance, lusdBalance),

      price: this.updateIfChanged(eq, "price", this.baseState.price, price),

      lusdInStabilityPool: this.updateIfChanged(
        eq,
        "lusdInStabilityPool",
        this.baseState.lusdInStabilityPool,
        lusdInStabilityPool
      ),

      total: this.updateIfChanged(equals, "total", this.baseState.total, total),

      totalRedistributed: this.updateIfChanged(
        equals,
        "totalRedistributed",
        this.baseState.totalRedistributed,
        totalRedistributed
      ),

      troveWithoutRewards: this.updateIfChanged(
        equals,
        "troveWithoutRewards",
        this.baseState.troveWithoutRewards,
        troveWithoutRewards
      ),

      deposit: this.updateIfChanged(equals, "deposit", this.baseState.deposit, deposit)
    };
  }

  private derive({
    troveWithoutRewards,
    totalRedistributed
  }: LiquityStoreBaseState): LiquityStoreDerivedState {
    return {
      trove: troveWithoutRewards.applyRewards(totalRedistributed)
    };
  }

  private reduceDerived({ trove }: LiquityStoreDerivedState): LiquityStoreDerivedState {
    assert(this.derivedState);

    return {
      trove: this.updateIfChanged(equals, "trove", this.derivedState.trove, trove)
    };
  }

  protected abstract reduceExtra(oldExtraState: T, extraStateUpdate: Partial<T>): T;

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

    if (this.onLoaded) {
      this.onLoaded();
    }
  }

  protected update(
    baseStateUpdate: Partial<LiquityStoreBaseState>,
    extraStateUpdate?: Partial<T>
  ): void {
    const oldState = this.state;

    this.baseState = this.reduce(baseStateUpdate);
    this.derivedState = this.reduceDerived(this.derive(this.baseState));
    this.extraState =
      extraStateUpdate && this.reduceExtra(asserted(this.extraState), extraStateUpdate);

    this.notify({
      newState: this.state,
      oldState,
      stateChange: difference(this.state, oldState)
    });
  }
}
