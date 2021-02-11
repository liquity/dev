import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { LQTYStake } from "./LQTYStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution } from "./Trove";
import { FrontendStatus, ReadableLiquity, TroveListingParams } from "./ReadableLiquity";

/** @internal */
export type _ReadableLiquityWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _LiquityReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableLiquity]: ReadableLiquity[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableLiquityWithExtraParams<T extends unknown[]>
  extends _ReadableLiquityWithExtraParamsBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<[address: string, trove: TroveWithPendingRedistribution][]>;

  getTroves(
    params: TroveListingParams,
    ...extraParams: T
  ): Promise<[address: string, trove: Trove][]>;
}

/** @internal */
export interface _LiquityReadCache<T extends unknown[]> extends _LiquityReadCacheBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): [address: string, trove: TroveWithPendingRedistribution][] | undefined;

  getTroves(
    params: TroveListingParams,
    ...extraParams: T
  ): [address: string, trove: Trove][] | undefined;
}

/** @internal */
export class _CachedReadableLiquity<T extends unknown[]>
  implements _ReadableLiquityWithExtraParams<T> {
  private _readable: _ReadableLiquityWithExtraParams<T>;
  private _cache: _LiquityReadCache<T>;

  constructor(readable: _ReadableLiquityWithExtraParams<T>, cache: _LiquityReadCache<T>) {
    this._readable = readable;
    this._cache = cache;
  }

  async getTotalRedistributed(...extraParams: T): Promise<Trove> {
    return (
      this._cache.getTotalRedistributed(...extraParams) ??
      this._readable.getTotalRedistributed(...extraParams)
    );
  }

  async getTroveBeforeRedistribution(
    address?: string,
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution> {
    return (
      this._cache.getTroveBeforeRedistribution(address, ...extraParams) ??
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
      this._cache.getNumberOfTroves(...extraParams) ??
      this._readable.getNumberOfTroves(...extraParams)
    );
  }

  async getPrice(...extraParams: T): Promise<Decimal> {
    return this._cache.getPrice(...extraParams) ?? this._readable.getPrice(...extraParams);
  }

  async getTotal(...extraParams: T): Promise<Trove> {
    return this._cache.getTotal(...extraParams) ?? this._readable.getTotal(...extraParams);
  }

  async getStabilityDeposit(address?: string, ...extraParams: T): Promise<StabilityDeposit> {
    return (
      this._cache.getStabilityDeposit(address, ...extraParams) ??
      this._readable.getStabilityDeposit(address, ...extraParams)
    );
  }

  async getLUSDInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDInStabilityPool(...extraParams) ??
      this._readable.getLUSDInStabilityPool(...extraParams)
    );
  }

  async getLUSDBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLUSDBalance(address, ...extraParams) ??
      this._readable.getLUSDBalance(address, ...extraParams)
    );
  }

  async getLQTYBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getLQTYBalance(address, ...extraParams) ??
      this._readable.getLQTYBalance(address, ...extraParams)
    );
  }

  async getCollateralSurplusBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getCollateralSurplusBalance(address, ...extraParams) ??
      this._readable.getCollateralSurplusBalance(address, ...extraParams)
    );
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<[address: string, trove: TroveWithPendingRedistribution][]>;

  getTroves(
    params: TroveListingParams,
    ...extraParams: T
  ): Promise<[address: string, trove: Trove][]>;

  async getTroves(
    params: TroveListingParams,
    ...extraParams: T
  ): Promise<[address: string, trove: Trove][]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(...extraParams),
      this._cache.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return troves.map(([address, trove]) => [
        address,
        trove.applyRedistribution(totalRedistributed)
      ]);
    } else {
      return troves;
    }
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
