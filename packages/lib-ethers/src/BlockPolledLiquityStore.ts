import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import {
  LiquityStoreState,
  LiquityStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LQTYStake
} from "@liquity/lib-base";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { LiquityConnection, _requireProvider } from "./connection";
import { EthersLiquityStore } from "./EthersLiquityStore";

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
export class BlockPolledLiquityStore extends EthersLiquityStore<BlockPolledLiquityStoreExtraState> {
  private readonly _provider: Provider;
  private readonly _readable: ReadableEthersLiquity;

  constructor(connection: LiquityConnection, readable?: ReadableEthersLiquity) {
    super(connection);

    this._provider = _requireProvider(connection);
    this._readable = readable ?? new ReadableEthersLiquity(connection);
  }

  private _get(blockTag?: number): Promise<LiquityStoreBaseState> {
    return promiseAllValues({
      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      lusdInStabilityPool: this._readable.getLUSDInStabilityPool({ blockTag }),
      fees: this._readable.getFees({ blockTag }),
      totalStakedLQTY: this._readable.getTotalStakedLQTY({ blockTag }),

      frontend: this._connection.frontendTag
        ? this._readable.getFrontendStatus(this._connection.frontendTag, { blockTag })
        : { status: "unregistered" },

      ...(this._connection.userAddress
        ? {
            accountBalance: this._provider
              .getBalance(this._connection.userAddress, blockTag)
              .then(decimalify),

            lusdBalance: this._readable.getLUSDBalance(this._connection.userAddress, { blockTag }),

            lqtyBalance: this._readable.getLQTYBalance(this._connection.userAddress, { blockTag }),

            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(
              this._connection.userAddress,
              { blockTag }
            ),

            troveWithoutRedistribution: this._readable.getTroveWithoutRewards(
              this._connection.userAddress,
              { blockTag }
            ),

            deposit: this._readable.getStabilityDeposit(this._connection.userAddress, { blockTag }),

            lqtyStake: this._readable.getLQTYStake(this._connection.userAddress, { blockTag }),

            ownFrontend: this._readable.getFrontendStatus(this._connection.userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            lusdBalance: Decimal.ZERO,
            lqtyBalance: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            troveWithoutRedistribution: new TroveWithPendingRedistribution(),
            deposit: new StabilityDeposit(),
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
