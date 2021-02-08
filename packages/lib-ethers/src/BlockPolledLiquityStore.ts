import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import {
  LiquityStoreState,
  LiquityStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LQTYStake,
  LiquityStore,
  _LiquityReadCache,
  Trove,
  Fees
} from "@liquity/lib-base";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { EthersLiquityConnection, _requireProvider } from "./EthersLiquityConnection";
import { EthersCallOverrides } from "./types";

/**
 * Extra state added to {@link @liquity/lib-base#LiquityStoreState} by
 * {@link BlockPolledLiquityStore}.
 *
 * @public
 */
export interface BlockPolledLiquityStoreExtraState {
  /**
   * Number of block that the store state was fetched from.
   *
   * @remarks
   * May be undefined when the store state is fetched for the first time.
   */
  blockTag?: number;
}

/**
 * The type of {@link BlockPolledLiquityStore}'s
 * {@link @liquity/lib-base#LiquityStore.state | state}.
 *
 * @public
 */
export type BlockPolledLiquityStoreState = LiquityStoreState<BlockPolledLiquityStoreExtraState>;

type Resolved<T> = T extends Promise<infer U> ? U : T;
type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

const promiseAllValues = <T>(object: T) => {
  const keys = Object.keys(object);

  return Promise.all(Object.values(object)).then(values =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

/**
 * Ethers-based {@link @liquity/lib-base#LiquityStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledLiquityStore extends LiquityStore<BlockPolledLiquityStoreExtraState> {
  readonly connection: EthersLiquityConnection;

  private readonly _readable: ReadableEthersLiquity;
  private readonly _provider: Provider;

  constructor(readable: ReadableEthersLiquity) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _requireProvider(readable.connection);
  }

  private _get(blockTag?: number): Promise<LiquityStoreBaseState> {
    const { userAddress, frontendTag } = this.connection;

    return promiseAllValues({
      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      lusdInStabilityPool: this._readable.getLUSDInStabilityPool({ blockTag }),
      fees: this._readable.getFees({ blockTag }),
      totalStakedLQTY: this._readable.getTotalStakedLQTY({ blockTag }),

      frontend: frontendTag
        ? this._readable.getFrontendStatus(frontendTag, { blockTag })
        : { status: "unregistered" },

      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            lusdBalance: this._readable.getLUSDBalance(userAddress, { blockTag }),
            lqtyBalance: this._readable.getLQTYBalance(userAddress, { blockTag }),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(userAddress, {
              blockTag
            }),
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag }),
            lqtyStake: this._readable.getLQTYStake(userAddress, { blockTag }),
            ownFrontend: this._readable.getFrontendStatus(userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            lusdBalance: Decimal.ZERO,
            lqtyBalance: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            troveBeforeRedistribution: new TroveWithPendingRedistribution(),
            stabilityDeposit: new StabilityDeposit(),
            lqtyStake: new LQTYStake(),
            ownFrontend: { status: "unregistered" }
          })
    });
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(state, {});
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(state, { blockTag });
      } else {
        this._load(state, { blockTag });
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return { blockTag: stateUpdate.blockTag ?? oldState.blockTag };
  }
}

/** @internal */
export class _BlockPolledLiquityStoreBasedCache
  implements Partial<_LiquityReadCache<[overrides?: EthersCallOverrides]>> {
  private _store: BlockPolledLiquityStore;

  constructor(store: BlockPolledLiquityStore) {
    this._store = store;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this._store.state.blockTag
    );
  }

  private _userHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.userAddress)
    );
  }

  private _frontendHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this._store.connection.frontendTag)
    );
  }

  getTotalRedistributed(overrides?: EthersCallOverrides): Trove | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalRedistributed;
    }
  }

  getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): TroveWithPendingRedistribution | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.troveBeforeRedistribution;
    }
  }

  getTrove(address?: string, overrides?: EthersCallOverrides): Trove | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.trove;
    }
  }

  getNumberOfTroves(overrides?: EthersCallOverrides): number | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.numberOfTroves;
    }
  }

  getPrice(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.price;
    }
  }

  getTotal(overrides?: EthersCallOverrides): Trove | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.total;
    }
  }

  getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): StabilityDeposit | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.stabilityDeposit;
    }
  }

  getLUSDInStabilityPool(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.lusdInStabilityPool;
    }
  }

  getLUSDBalance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.lusdBalance;
    }
  }

  getLQTYBalance(address?: string, overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.lqtyBalance;
    }
  }

  getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Decimal | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.collateralSurplusBalance;
    }
  }

  getFees(overrides?: EthersCallOverrides): Fees | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.fees;
    }
  }

  getLQTYStake(address?: string, overrides?: EthersCallOverrides): LQTYStake | undefined {
    if (this._userHit(address, overrides)) {
      return this._store.state.lqtyStake;
    }
  }

  getTotalStakedLQTY(overrides?: EthersCallOverrides): Decimal | undefined {
    if (this._blockHit(overrides)) {
      return this._store.state.totalStakedLQTY;
    }
  }

  getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): { status: "unregistered" } | { status: "registered"; kickbackRate: Decimal } | undefined {
    if (this._frontendHit(address, overrides)) {
      return this._store.state.frontend;
    }
  }
}
