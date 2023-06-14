import assert from "assert";
import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  LiquityStoreState,
  LiquityStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  LQTYStake,
  LiquityStore,
  Fees
} from "@liquity/lib-base";

import { decimalify, promiseAllValues } from "./_utils";
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

  /**
   * Timestamp of latest block (number of seconds since epoch).
   */
  blockTimestamp: number;

  /** @internal */
  _feesFactory: (blockTimestamp: number, recoveryMode: boolean) => Fees;
}

/**
 * The type of {@link BlockPolledLiquityStore}'s
 * {@link @liquity/lib-base#LiquityStore.state | state}.
 *
 * @public
 */
export type BlockPolledLiquityStoreState = LiquityStoreState<BlockPolledLiquityStoreExtraState>;

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

  private async _get(
    blockTag?: number
  ): Promise<[baseState: LiquityStoreBaseState, extraState: BlockPolledLiquityStoreExtraState]> {
    const { userAddress, frontendTag } = this.connection;

    const {
      blockTimestamp,
      _feesFactory,
      calculateRemainingLQTY,
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: this._readable._getBlockTimestamp(blockTag),
      _feesFactory: this._readable._getFeesFactory({ blockTag }),
      calculateRemainingLQTY: this._readable._getRemainingLiquidityMiningLQTYRewardCalculator({
        blockTag
      }),

      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      lusdInStabilityPool: this._readable.getLUSDInStabilityPool({ blockTag }),
      totalStakedLQTY: this._readable.getTotalStakedLQTY({ blockTag }),
      _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution({ blockTag }),
      totalStakedUniTokens: this._readable.getTotalStakedUniTokens({ blockTag }),
      remainingStabilityPoolLQTYReward: this._readable.getRemainingStabilityPoolLQTYReward({
        blockTag
      }),

      frontend: frontendTag
        ? this._readable.getFrontendStatus(frontendTag, { blockTag })
        : { status: "unregistered" as const },

      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            lusdBalance: this._readable.getLUSDBalance(userAddress, { blockTag }),
            lqtyBalance: this._readable.getLQTYBalance(userAddress, { blockTag }),
            uniTokenBalance: this._readable.getUniTokenBalance(userAddress, { blockTag }),
            uniTokenAllowance: this._readable.getUniTokenAllowance(userAddress, { blockTag }),
            liquidityMiningStake: this._readable.getLiquidityMiningStake(userAddress, { blockTag }),
            liquidityMiningLQTYReward: this._readable.getLiquidityMiningLQTYReward(userAddress, {
              blockTag
            }),
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
            uniTokenBalance: Decimal.ZERO,
            uniTokenAllowance: Decimal.ZERO,
            liquidityMiningStake: Decimal.ZERO,
            liquidityMiningLQTYReward: Decimal.ZERO,
            collateralSurplusBalance: Decimal.ZERO,
            troveBeforeRedistribution: new TroveWithPendingRedistribution(
              AddressZero,
              "nonExistent"
            ),
            stabilityDeposit: new StabilityDeposit(
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              Decimal.ZERO,
              AddressZero
            ),
            lqtyStake: new LQTYStake(),
            ownFrontend: { status: "unregistered" as const }
          })
    });

    return [
      {
        ...baseState,
        _feesInNormalMode: _feesFactory(blockTimestamp, false),
        remainingLiquidityMiningLQTYReward: calculateRemainingLQTY(blockTimestamp)
      },
      {
        blockTag,
        blockTimestamp,
        _feesFactory
      }
    ];
  }

  /** @internal @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(...state);
      }
    });

    const handleBlock = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    let latestBlock: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const blockListener = (blockTag: number) => {
      latestBlock = Math.max(blockTag, latestBlock ?? blockTag);

      if (timerId !== undefined) {
        clearTimeout(timerId);
      }

      timerId = setTimeout(() => {
        assert(latestBlock !== undefined);
        handleBlock(latestBlock);
      }, 50);
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);

      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
      _feesFactory: stateUpdate._feesFactory ?? oldState._feesFactory
    };
  }
}
