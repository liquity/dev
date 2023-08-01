import { Decimal } from "./Decimal";
import { Fees } from "./Fees";
import { STBLStake } from "./STBLStake";
import { StabilityDeposit } from "./StabilityDeposit";
import { Trove, TroveWithPendingRedistribution, UserTrove } from "./Trove";
import { FrontendStatus, ReadableStabilio, TroveListingParams } from "./ReadableStabilio";

/** @internal */
export type _ReadableStabilioWithExtraParamsBase<T extends unknown[]> = {
  [P in keyof ReadableStabilio]: ReadableStabilio[P] extends (...params: infer A) => infer R
    ? (...params: [...originalParams: A, ...extraParams: T]) => R
    : never;
};

/** @internal */
export type _StabilioReadCacheBase<T extends unknown[]> = {
  [P in keyof ReadableStabilio]: ReadableStabilio[P] extends (...args: infer A) => Promise<infer R>
    ? (...params: [...originalParams: A, ...extraParams: T]) => R | undefined
    : never;
};

// Overloads get lost in the mapping, so we need to define them again...

/** @internal */
export interface _ReadableStabilioWithExtraParams<T extends unknown[]>
  extends _ReadableStabilioWithExtraParamsBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;
}

/** @internal */
export interface _StabilioReadCache<T extends unknown[]> extends _StabilioReadCacheBase<T> {
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    ...extraParams: T
  ): TroveWithPendingRedistribution[] | undefined;

  getTroves(params: TroveListingParams, ...extraParams: T): UserTrove[] | undefined;
}

/** @internal */
export class _CachedReadableStabilio<T extends unknown[]>
  implements _ReadableStabilioWithExtraParams<T> {
  private _readable: _ReadableStabilioWithExtraParams<T>;
  private _cache: _StabilioReadCache<T>;

  constructor(readable: _ReadableStabilioWithExtraParams<T>, cache: _StabilioReadCache<T>) {
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

  async getTrove(address?: string, ...extraParams: T): Promise<UserTrove> {
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

  async getRemainingStabilityPoolSTBLReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingStabilityPoolSTBLReward(...extraParams) ??
      this._readable.getRemainingStabilityPoolSTBLReward(...extraParams)
    );
  }

  async getXBRLInStabilityPool(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXBRLInStabilityPool(...extraParams) ??
      this._readable.getXBRLInStabilityPool(...extraParams)
    );
  }

  async getXBRLBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXBRLBalance(address, ...extraParams) ??
      this._readable.getXBRLBalance(address, ...extraParams)
    );
  }

  async getSTBLBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getSTBLBalance(address, ...extraParams) ??
      this._readable.getSTBLBalance(address, ...extraParams)
    );
  }

  async getXbrlStblUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlStblUniTokenBalance(address, ...extraParams) ??
      this._readable.getXbrlStblUniTokenBalance(address, ...extraParams)
    );
  }

  async getXbrlStblUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlStblUniTokenAllowance(address, ...extraParams) ??
      this._readable.getXbrlStblUniTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingXbrlStblLiquidityMiningSTBLReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingXbrlStblLiquidityMiningSTBLReward(...extraParams) ??
      this._readable.getRemainingXbrlStblLiquidityMiningSTBLReward(...extraParams)
    );
  }

  async getXbrlStblLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlStblLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getXbrlStblLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedXbrlStblUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedXbrlStblUniTokens(...extraParams) ??
      this._readable.getTotalStakedXbrlStblUniTokens(...extraParams)
    );
  }

  async getXbrlStblLiquidityMiningSTBLReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlStblLiquidityMiningSTBLReward(address, ...extraParams) ??
      this._readable.getXbrlStblLiquidityMiningSTBLReward(address, ...extraParams)
    );
  }

  async getXbrlWethUniTokenBalance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlWethUniTokenBalance(address, ...extraParams) ??
      this._readable.getXbrlWethUniTokenBalance(address, ...extraParams)
    );
  }

  async getXbrlWethUniTokenAllowance(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlWethUniTokenAllowance(address, ...extraParams) ??
      this._readable.getXbrlWethUniTokenAllowance(address, ...extraParams)
    );
  }

  async getRemainingXbrlWethLiquidityMiningSTBLReward(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getRemainingXbrlWethLiquidityMiningSTBLReward(...extraParams) ??
      this._readable.getRemainingXbrlWethLiquidityMiningSTBLReward(...extraParams)
    );
  }

  async getXbrlWethLiquidityMiningStake(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlWethLiquidityMiningStake(address, ...extraParams) ??
      this._readable.getXbrlWethLiquidityMiningStake(address, ...extraParams)
    );
  }

  async getTotalStakedXbrlWethUniTokens(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedXbrlWethUniTokens(...extraParams) ??
      this._readable.getTotalStakedXbrlWethUniTokens(...extraParams)
    );
  }

  async getXbrlWethLiquidityMiningSTBLReward(address?: string, ...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getXbrlWethLiquidityMiningSTBLReward(address, ...extraParams) ??
      this._readable.getXbrlWethLiquidityMiningSTBLReward(address, ...extraParams)
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
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]>;

  async getTroves(params: TroveListingParams, ...extraParams: T): Promise<UserTrove[]> {
    const { beforeRedistribution, ...restOfParams } = params;

    const [totalRedistributed, troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(...extraParams),
      this._cache.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams) ??
        this._readable.getTroves({ beforeRedistribution: true, ...restOfParams }, ...extraParams)
    ]);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  async getFees(...extraParams: T): Promise<Fees> {
    return this._cache.getFees(...extraParams) ?? this._readable.getFees(...extraParams);
  }

  async getSTBLStake(address?: string, ...extraParams: T): Promise<STBLStake> {
    return (
      this._cache.getSTBLStake(address, ...extraParams) ??
      this._readable.getSTBLStake(address, ...extraParams)
    );
  }

  async getTotalStakedSTBL(...extraParams: T): Promise<Decimal> {
    return (
      this._cache.getTotalStakedSTBL(...extraParams) ??
      this._readable.getTotalStakedSTBL(...extraParams)
    );
  }

  async getFrontendStatus(address?: string, ...extraParams: T): Promise<FrontendStatus> {
    return (
      this._cache.getFrontendStatus(address, ...extraParams) ??
      this._readable.getFrontendStatus(address, ...extraParams)
    );
  }
}
