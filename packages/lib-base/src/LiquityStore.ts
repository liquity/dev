import assert from "assert";

import { Decimal } from "@liquity/decimal";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRewards } from "./Trove";

export type LiquityStoreState = {
  numberOfTroves: number;
  accountBalance: Decimal;
  quiBalance: Decimal;
  price: Decimal;
  quiInStabilityPool: Decimal;
  total: Trove;
  totalRedistributed: Trove;
  troveWithoutRewards: TroveWithPendingRewards;
  deposit: StabilityDeposit;
};

export type LiquityStoreDerivedState = {
  trove: Trove;
};

export type CombinedLiquityStoreState<T> = LiquityStoreState & LiquityStoreDerivedState & T;

export type LiquityStoreListener<T> = (
  newState: CombinedLiquityStoreState<T>,
  oldState?: CombinedLiquityStoreState<T>
) => void;

const strictEquals = <T>(a: T, b: T) => a === b;
const eq = <T extends { eq(that: T): boolean }>(a: T, b: T) => a.eq(b);
const equals = <T extends { equals(that: T): boolean }>(a: T, b: T) => a.equals(b);

const asserted = <T>(x?: T): T => {
  assert(x);
  return x;
};

const wrap = <A extends any[], R>(f: (...args: A) => R) => (...args: A) => f(...args);

export abstract class LiquityStore<T = {}> {
  logging = true;
  onLoaded?: () => void;

  protected loaded = false;

  private state?: LiquityStoreState;
  private derivedState?: LiquityStoreDerivedState;
  private extraState?: T;

  private listeners = new Set<LiquityStoreListener<T>>();

  abstract start(): () => void;

  protected logUpdate<U>(name: string, next: U) {
    if (this.logging) {
      console.log(`${name} updated to ${next}`);
    }

    return next;
  }

  protected updateIfChanged<U>(equals: (a: U, b: U) => boolean, name: string, prev: U, next?: U) {
    return next !== undefined && !equals(prev, next) ? this.logUpdate(name, next) : prev;
  }

  private reduce({
    numberOfTroves,
    accountBalance,
    quiBalance,
    price,
    quiInStabilityPool,
    total,
    totalRedistributed,
    troveWithoutRewards,
    deposit
  }: Partial<LiquityStoreState>): LiquityStoreState {
    assert(this.state);

    return {
      numberOfTroves: this.updateIfChanged(
        strictEquals,
        "numberOfTroves",
        this.state.numberOfTroves,
        numberOfTroves
      ),

      accountBalance: this.updateIfChanged(
        eq,
        "accountBalance",
        this.state.accountBalance,
        accountBalance
      ),

      quiBalance: this.updateIfChanged(eq, "quiBalance", this.state.quiBalance, quiBalance),

      price: this.updateIfChanged(eq, "price", this.state.price, price),

      quiInStabilityPool: this.updateIfChanged(
        eq,
        "quiInStabilityPool",
        this.state.quiInStabilityPool,
        quiInStabilityPool
      ),

      total: this.updateIfChanged(equals, "total", this.state.total, total),

      totalRedistributed: this.updateIfChanged(
        equals,
        "totalRedistributed",
        this.state.totalRedistributed,
        totalRedistributed
      ),

      troveWithoutRewards: this.updateIfChanged(
        equals,
        "troveWithoutRewards",
        this.state.troveWithoutRewards,
        troveWithoutRewards
      ),

      deposit: this.updateIfChanged(equals, "deposit", this.state.deposit, deposit)
    };
  }

  private derive({
    troveWithoutRewards,
    totalRedistributed
  }: LiquityStoreState): LiquityStoreDerivedState {
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

  subscribe(listener: LiquityStoreListener<T>) {
    const uniqueListener = wrap(listener);

    this.listeners.add(uniqueListener);

    return () => {
      this.listeners.delete(uniqueListener);
    };
  }

  protected load(state: LiquityStoreState, extraState?: T) {
    assert(!this.loaded);

    this.state = state;
    this.derivedState = this.derive(state);
    this.extraState = extraState;
    this.loaded = true;

    if (this.onLoaded) {
      this.onLoaded();
    }

    this.notify(Object.assign({}, this.state, this.derivedState, this.extraState));
  }

  protected update(stateUpdate: Partial<LiquityStoreState>, extraStateUpdate?: Partial<T>) {
    const state = this.reduce(stateUpdate);
    const derivedState = this.reduceDerived(this.derive(state));
    const extraState =
      extraStateUpdate && this.reduceExtra(asserted(this.extraState), extraStateUpdate);

    this.notify(
      Object.assign({}, state, derivedState, extraState),
      Object.assign({}, this.state, this.derivedState, this.extraState)
    );

    this.state = state;
    this.derivedState = derivedState;
    this.extraState = extraState;
  }
}
