import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import {
  LiquityStore,
  LiquityStoreState,
  LiquityStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LQTYStake
} from "@liquity/lib-base";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { LiquityConnection, _getProvider } from "./connection";

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
  private readonly _provider: Provider;
  private readonly _readableLiquity: ReadableEthersLiquity;
  private readonly _frontendTag?: string;
  private readonly _userAddress?: string;

  constructor(
    connection: LiquityConnection,
    readableLiquity?: ReadableEthersLiquity,
    frontendTag?: string,
    userAddress?: string
  ) {
    super();

    this._provider = _getProvider(connection);
    this._readableLiquity = readableLiquity ?? new ReadableEthersLiquity(connection);
    this._frontendTag = frontendTag;
    this._userAddress = userAddress;
  }

  private _get(blockTag?: number): Promise<LiquityStoreBaseState> {
    return promiseAllValues({
      price: this._readableLiquity.getPrice({ blockTag }),
      numberOfTroves: this._readableLiquity.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readableLiquity.getTotalRedistributed({ blockTag }),
      total: this._readableLiquity.getTotal({ blockTag }),
      lusdInStabilityPool: this._readableLiquity.getLUSDInStabilityPool({ blockTag }),
      fees: this._readableLiquity.getFees({ blockTag }),
      totalStakedLQTY: this._readableLiquity.getTotalStakedLQTY({ blockTag }),

      frontend: this._frontendTag
        ? this._readableLiquity.getFrontendStatus(this._frontendTag, { blockTag })
        : { status: "unregistered" },

      ...(this._userAddress
        ? {
            accountBalance: this._provider.getBalance(this._userAddress, blockTag).then(decimalify),
            lusdBalance: this._readableLiquity.getLUSDBalance(this._userAddress, { blockTag }),
            lqtyBalance: this._readableLiquity.getLQTYBalance(this._userAddress, { blockTag }),
            collateralSurplusBalance: this._readableLiquity.getCollateralSurplusBalance(
              this._userAddress,
              { blockTag }
            ),
            troveWithoutRedistribution: this._readableLiquity.getTroveWithoutRewards(
              this._userAddress,
              { blockTag }
            ),
            deposit: this._readableLiquity.getStabilityDeposit(this._userAddress, { blockTag }),
            lqtyStake: this._readableLiquity.getLQTYStake(this._userAddress, { blockTag }),
            ownFrontend: this._readableLiquity.getFrontendStatus(this._userAddress, { blockTag })
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

  /** @override */
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

  /** @override */
  protected _reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return { blockTag: stateUpdate.blockTag ?? oldState.blockTag };
  }
}
