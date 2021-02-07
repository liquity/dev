import { Decimal } from "@liquity/decimal";

import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution } from "./Trove";
import { FrontendStatus, ReadableLiquity } from "./ReadableLiquity";

/** @internal */
export type _ReadableLiquityWithExtraParams<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _LiquityReadCache<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

/** @internal */
export class _CachedReadableLiquity<T extends unknown[]>
  implements _ReadableLiquityWithExtraParams<T> {
  private _readable: _ReadableLiquityWithExtraParams<T>;
  private _cache: Partial<_LiquityReadCache<T>>;

  constructor(readable: _ReadableLiquityWithExtraParams<T>, cache: Partial<_LiquityReadCache<T>>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotalRedistributed?.call(this._cache, ...extraParams) ??
      this._readable.getTotalRedistributed(...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution> {
    return (
      this._cache.getTroveBeforeRedistribution?.call(this._cache, address, ...extraParams) ??
      this._readable.getTroveBeforeRedistribution(address, ...extraParams)
    );
  }

  async getTrove(address?: string, ...extraParams: T): Promise<Trove> {
    const [troveBeforeRedistribution, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, ...extraParams),
      this.getTotalRedistributed(...extraParams)
    ]);

    return troveBeforeRedistribution.applyRedistribution(totalRedistributed);
  }

  async getNumberOfTroves(...extraParams: T): Promise<number> {
    return (
      this._cache.getNumberOfTroves?.call(this._cache, ...extraParams) ??
      this._readable.getNumberOfTroves(...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getPrice?.call(this._cache, ...extraParams) ??
      this._readable.getPrice(...extraParams)
    );
  }

  async getTotal(...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotal?.call(this._cache, ...extraParams) ??
      this._readable.getTotal(...extraParams)
    );
  }

  async getStabilityDeposit(address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit?.call(this._cache, address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getLUSDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDInStabilityPool?.call(this._cache, ...extraParams) ??
      this._readable.getLUSDInStabilityPool(...extraParams)
    );
  }

  async getLUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDBalance?.call(this._cache, address, ...extraParams) ??
      this._readable.getLUSDBalance(address, ...extraParams)
    );
  }

  async getLQTYBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLQTYBalance?.call(this._cache, address, ...extraParams) ??
      this._readable.getLQTYBalance(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance?.call(this._cache, address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  async getLastTroves(
    startIdx: number,
    numberOfTroves: number,
    ...extraParams: T
  ): Promise<[string, TroveWithPendingRedistribution][]> {
    return (
      this._cache.getLastTroves?.call(this._cache, startIdx, numberOfTroves, ...extraParams) ??
      this._readable.getLastTroves(startIdx, numberOfTroves, ...extraParams)
    );
  }

  async getFirstTroves(
    startIdx: number,
    numberOfTroves: number,
    ...extraParams: T
  ): Promise<[string, TroveWithPendingRedistribution][]> {
    return (
      this._cache.getFirstTroves?.call(this._cache, startIdx, numberOfTroves, ...extraParams) ??
      this._readable.getFirstTroves(startIdx, numberOfTroves, ...extraParams)
    );
  }

  async getFees(...extraParams: T): Promise<Fees> {
    return (
      this._cache.getFees?.call(this._cache, ...extraParams) ??
      this._readable.getFees(...extraParams)
    );
  }

  async getLQTYStake(address?: string, ...extraParams: T): Promise<LQTYStake> {
    return (
      this._cache.getLQTYStake?.call(this._cache, address, ...extraParams) ??
      this._readable.getLQTYStake(address, ...extraParams)
    );
  }

  async getTotalStakedLQTY(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedLQTY?.call(this._cache, ...extraParams) ??
      this._readable.getTotalStakedLQTY(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus?.call(this._cache, address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}
