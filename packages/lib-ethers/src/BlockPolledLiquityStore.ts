import { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  LiquityStoreState,
  LiquityStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LQTYStake,
  LiquityStore
} from "@liquity/lib-base";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";
import { EthersLiquityConnection, _getProvider } from "./EthersLiquityConnection";
import { EthersCallOverrides, EthersProvider } from "./types";

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

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());

/**
 * Ethers-based {@link @liquity/lib-base#LiquityStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledLiquityStore extends LiquityStore<BlockPolledLiquityStoreExtraState> {
  readonly connection: EthersLiquityConnection;

  private readonly _readable: ReadableEthersLiquity;
  private readonly _provider: EthersProvider;

  constructor(readable: ReadableEthersLiquity) {
    super();

    this.connection = readable.connection;
    this._readable = readable;
    this._provider = _getProvider(readable.connection);
  }

  private async _getRiskiestTroveBeforeRedistribution(
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const riskiestTroves = await this._readable.getTroves(
      { first: 1, sortedBy: "ascendingCollateralRatio", beforeRedistribution: true },
      overrides
    );

    if (riskiestTroves.length === 0) {
      return new TroveWithPendingRedistribution(AddressZero, "nonExistent");
    }

    return riskiestTroves[0];
  }

  private _get(blockTag?: number): Promise<LiquityStoreBaseState> {
    const { userAddress, frontendTag } = this.connection;

    return promiseAllValues({
      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      lusdInStabilityPool: this._readable.getLUSDInStabilityPool({ blockTag }),
      _feesInNormalMode: this._readable._getFeesInNormalMode({ blockTag }),
      totalStakedLQTY: this._readable.getTotalStakedLQTY({ blockTag }),
      _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution({ blockTag }),

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
            troveBeforeRedistribution: new TroveWithPendingRedistribution(
              AddressZero,
              "nonExistent"
            ),
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
