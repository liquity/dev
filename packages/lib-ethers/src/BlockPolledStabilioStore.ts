import { AddressZero } from "@ethersproject/constants";

import {
  Decimal,
  StabilioStoreState,
  StabilioStoreBaseState,
  TroveWithPendingRedistribution,
  StabilityDeposit,
  STBLStake,
  StabilioStore,
  Fees
} from "@stabilio/lib-base";

import { decimalify, promiseAllValues } from "./_utils";
import { ReadableEthersStabilio } from "./ReadableEthersStabilio";
import { EthersStabilioConnection, _getProvider } from "./EthersStabilioConnection";
import { EthersCallOverrides, EthersProvider } from "./types";

/**
 * Extra state added to {@link @stabilio/lib-base#StabilioStoreState} by
 * {@link BlockPolledStabilioStore}.
 *
 * @public
 */
export interface BlockPolledStabilioStoreExtraState {
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
 * The type of {@link BlockPolledStabilioStore}'s
 * {@link @stabilio/lib-base#StabilioStore.state | state}.
 *
 * @public
 */
export type BlockPolledStabilioStoreState = StabilioStoreState<BlockPolledStabilioStoreExtraState>;

/**
 * Ethers-based {@link @stabilio/lib-base#StabilioStore} that updates state whenever there's a new
 * block.
 *
 * @public
 */
export class BlockPolledStabilioStore extends StabilioStore<BlockPolledStabilioStoreExtraState> {
  readonly connection: EthersStabilioConnection;

  private readonly _readable: ReadableEthersStabilio;
  private readonly _provider: EthersProvider;

  constructor(readable: ReadableEthersStabilio) {
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
  ): Promise<[baseState: StabilioStoreBaseState, extraState: BlockPolledStabilioStoreExtraState]> {
    const { userAddress, frontendTag } = this.connection;

    const {
      blockTimestamp,
      _feesFactory,
      calculateRemainingSTBLInXbrlWethLiquidityPool,
      calculateRemainingSTBLInXbrlStblLiquidityPool,
      ...baseState
    } = await promiseAllValues({
      blockTimestamp: this._readable._getBlockTimestamp(blockTag),
      _feesFactory: this._readable._getFeesFactory({ blockTag }),
      calculateRemainingSTBLInXbrlWethLiquidityPool: this._readable._getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator({
        blockTag
      }),
      calculateRemainingSTBLInXbrlStblLiquidityPool: this._readable._getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator({
        blockTag
      }),
      price: this._readable.getPrice({ blockTag }),
      numberOfTroves: this._readable.getNumberOfTroves({ blockTag }),
      totalRedistributed: this._readable.getTotalRedistributed({ blockTag }),
      total: this._readable.getTotal({ blockTag }),
      xbrlInStabilityPool: this._readable.getXBRLInStabilityPool({ blockTag }),
      totalStakedSTBL: this._readable.getTotalStakedSTBL({ blockTag }),
      _riskiestTroveBeforeRedistribution: this._getRiskiestTroveBeforeRedistribution({ blockTag }),
      totalStakedXbrlWethUniTokens: this._readable.getTotalStakedXbrlWethUniTokens({ blockTag }),
      totalStakedXbrlStblUniTokens: this._readable.getTotalStakedXbrlStblUniTokens({ blockTag }),
      remainingStabilityPoolSTBLReward: this._readable.getRemainingStabilityPoolSTBLReward({
        blockTag
      }),

      frontend: frontendTag
        ? this._readable.getFrontendStatus(frontendTag, { blockTag })
        : { status: "unregistered" as const },

      ...(userAddress
        ? {
            accountBalance: this._provider.getBalance(userAddress, blockTag).then(decimalify),
            xbrlBalance: this._readable.getXBRLBalance(userAddress, { blockTag }),
            stblBalance: this._readable.getSTBLBalance(userAddress, { blockTag }),
            xbrlWethUniTokenBalance: this._readable.getXbrlWethUniTokenBalance(userAddress, { blockTag }),
            xbrlWethUniTokenAllowance: this._readable.getXbrlWethUniTokenAllowance(userAddress, { blockTag }),
            xbrlWethLiquidityMiningStake: this._readable.getXbrlWethLiquidityMiningStake(userAddress, { blockTag }),
            xbrlWethLiquidityMiningSTBLReward: this._readable.getXbrlWethLiquidityMiningSTBLReward(userAddress, {
              blockTag
            }),
            xbrlStblUniTokenBalance: this._readable.getXbrlStblUniTokenBalance(userAddress, { blockTag }),
            xbrlStblUniTokenAllowance: this._readable.getXbrlStblUniTokenAllowance(userAddress, { blockTag }),
            xbrlStblLiquidityMiningStake: this._readable.getXbrlStblLiquidityMiningStake(userAddress, { blockTag }),
            xbrlStblLiquidityMiningSTBLReward: this._readable.getXbrlStblLiquidityMiningSTBLReward(userAddress, {
              blockTag
            }),
            collateralSurplusBalance: this._readable.getCollateralSurplusBalance(userAddress, {
              blockTag
            }),
            troveBeforeRedistribution: this._readable.getTroveBeforeRedistribution(userAddress, {
              blockTag
            }),
            stabilityDeposit: this._readable.getStabilityDeposit(userAddress, { blockTag }),
            stblStake: this._readable.getSTBLStake(userAddress, { blockTag }),
            ownFrontend: this._readable.getFrontendStatus(userAddress, { blockTag })
          }
        : {
            accountBalance: Decimal.ZERO,
            xbrlBalance: Decimal.ZERO,
            stblBalance: Decimal.ZERO,
            xbrlWethUniTokenBalance: Decimal.ZERO,
            xbrlWethUniTokenAllowance: Decimal.ZERO,
            xbrlWethLiquidityMiningStake: Decimal.ZERO,
            xbrlWethLiquidityMiningSTBLReward: Decimal.ZERO,
            xbrlStblUniTokenBalance: Decimal.ZERO,
            xbrlStblUniTokenAllowance: Decimal.ZERO,
            xbrlStblLiquidityMiningStake: Decimal.ZERO,
            xbrlStblLiquidityMiningSTBLReward: Decimal.ZERO,
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
            stblStake: new STBLStake(),
            ownFrontend: { status: "unregistered" as const }
          })
    });

    return [
      {
        ...baseState,
        _feesInNormalMode: _feesFactory(blockTimestamp, false),
        remainingXbrlWethLiquidityMiningSTBLReward: calculateRemainingSTBLInXbrlWethLiquidityPool(blockTimestamp),
        remainingXbrlStblLiquidityMiningSTBLReward: calculateRemainingSTBLInXbrlStblLiquidityPool(blockTimestamp)
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

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(...state);
      } else {
        this._load(...state);
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @internal @override */
  protected _reduceExtra(
    oldState: BlockPolledStabilioStoreExtraState,
    stateUpdate: Partial<BlockPolledStabilioStoreExtraState>
  ): BlockPolledStabilioStoreExtraState {
    return {
      blockTag: stateUpdate.blockTag ?? oldState.blockTag,
      blockTimestamp: stateUpdate.blockTimestamp ?? oldState.blockTimestamp,
      _feesFactory: stateUpdate._feesFactory ?? oldState._feesFactory
    };
  }
}
