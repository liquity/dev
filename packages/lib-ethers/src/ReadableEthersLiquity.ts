import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";
import {
  Fees,
  FrontendStatus,
  LiquityStore,
  LQTYStake,
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution,
  _CachedReadableLiquity
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";

import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  EthersLiquityConnection,
  EthersLiquityConnectionOptionalParams,
  EthersLiquityStoreOption,
  _connect,
  _getContracts,
  _requireAddress,
  _requireFrontendAddress
} from "./EthersLiquityConnection";

import {
  BlockPolledLiquityStore,
  _BlockPolledLiquityStoreBasedCache
} from "./BlockPolledLiquityStore";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to LiquityDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999832508430720967");
const BETA = Decimal.from(2);

enum TroveStatus {
  nonExistent,
  active,
  closed
}

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

/**
 * Ethers-based implementation of {@link @liquity/lib-base#ReadableLiquity}.
 *
 * @public
 */
export class ReadableEthersLiquity implements ReadableLiquity {
  readonly connection: EthersLiquityConnection;

  /** @internal */
  constructor(connection: EthersLiquityConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersLiquityConnection & { useStore: "blockPolled" }
  ): ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;

  /** @internal */
  static _from(connection: EthersLiquityConnection): ReadableEthersLiquity;

  /** @internal */
  static _from(connection: EthersLiquityConnection): ReadableEthersLiquity {
    const readable = new ReadableEthersLiquity(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersLiquity(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersLiquityConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersLiquityWithStore<BlockPolledLiquityStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersLiquityConnectionOptionalParams
  ): Promise<ReadableEthersLiquity>;

  /**
   * Connect to the Liquity protocol and create a `ReadableEthersLiquity` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersLiquityConnectionOptionalParams
  ): Promise<ReadableEthersLiquity> {
    return ReadableEthersLiquity._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersLiquity` is a {@link ReadableEthersLiquityWithStore}.
   */
  hasStore(): this is ReadableEthersLiquityWithStore;

  /**
   * Check whether this `ReadableEthersLiquity` is a
   * {@link ReadableEthersLiquityWithStore}\<{@link BlockPolledLiquityStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersLiquityWithStore<BlockPolledLiquityStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_ETH({ ...overrides }).then(decimalify),
      troveManager.L_LUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTroveBeforeRedistribution} */
  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    address ??= _requireAddress(this.connection);
    const { troveManager } = _getContracts(this.connection);

    const [trove, snapshot] = await Promise.all([
      troveManager.Troves(address, { ...overrides }),
      troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (trove.status === TroveStatus.active) {
      return new TroveWithPendingRedistribution(
        new Decimal(trove.coll),
        new Decimal(trove.debt),
        new Decimal(trove.stake),
        new Trove(new Decimal(snapshot.ETH), new Decimal(snapshot.LUSDDebt))
      );
    } else {
      return new TroveWithPendingRedistribution();
    }
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTrove} */
  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<Trove> {
    address ??= _requireAddress(this.connection);

    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getNumberOfTroves} */
  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this.connection);

    return (await troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getPrice} */
  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return new Decimal(await priceFeed.callStatic.fetchPrice({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool, defaultPool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        activePool.getETH({ ...overrides }),
        activePool.getLUSDDebt({ ...overrides }),
        defaultPool.getETH({ ...overrides }),
        defaultPool.getLUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral.add(liquidatedCollateral), activeDebt.add(closedDebt));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [initialLUSD, currentLUSD, collateralGain, lqtyReward] = await Promise.all(
      [
        stabilityPool.deposits(address, { ...overrides }).then(d => d.initialValue),
        stabilityPool.getCompoundedLUSDDeposit(address, { ...overrides }),
        stabilityPool.getDepositorETHGain(address, { ...overrides }),
        stabilityPool.getDepositorLQTYGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new StabilityDeposit(initialLUSD, currentLUSD, collateralGain, lqtyReward);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLUSDInStabilityPool} */
  async getLUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return new Decimal(await stabilityPool.getTotalLUSDDeposits({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLUSDBalance} */
  async getLUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { lusdToken } = _getContracts(this.connection);

    return new Decimal(await lusdToken.balanceOf(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLQTYBalance} */
  async getLQTYBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { lqtyToken } = _getContracts(this.connection);

    return new Decimal(await lqtyToken.balanceOf(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance} */
  async getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return new Decimal(await collSurplusPool.getCollateral(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLastTroves} */
  async getLastTroves(
    startIdx: number,
    numberOfTroves: number,
    overrides?: EthersCallOverrides
  ): Promise<[string, TroveWithPendingRedistribution][]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    const troves = await multiTroveGetter.getMultipleSortedTroves(-(startIdx + 1), numberOfTroves, {
      ...overrides
    });

    return mapMultipleSortedTrovesToTroves(troves);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFirstTroves} */
  async getFirstTroves(
    startIdx: number,
    numberOfTroves: number,
    overrides?: EthersCallOverrides
  ): Promise<[string, TroveWithPendingRedistribution][]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    const troves = await multiTroveGetter.getMultipleSortedTroves(startIdx, numberOfTroves, {
      ...overrides
    });

    return mapMultipleSortedTrovesToTroves(troves);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const { troveManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    const lastFeeOperation = new Date(1000 * lastFeeOperationTime.toNumber());

    return new Fees(lastFeeOperation, baseRateWithoutDecay, MINUTE_DECAY_FACTOR, BETA);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLQTYStake} */
  async getLQTYStake(address?: string, overrides?: EthersCallOverrides): Promise<LQTYStake> {
    address ??= _requireAddress(this.connection);
    const { lqtyStaking } = _getContracts(this.connection);

    const [stakedLQTY, collateralGain, lusdGain] = await Promise.all(
      [
        lqtyStaking.stakes(address, { ...overrides }),
        lqtyStaking.getPendingETHGain(address, { ...overrides }),
        lqtyStaking.getPendingLUSDGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new LQTYStake(stakedLQTY, collateralGain, lusdGain);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotalStakedLQTY} */
  async getTotalStakedLQTY(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { lqtyStaking } = _getContracts(this.connection);

    return new Decimal(await lqtyStaking.totalLQTYStaked({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFrontendStatus} */
  async getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    address ??= _requireFrontendAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const { registered, kickbackRate } = await stabilityPool.frontEnds(address, { ...overrides });

    return registered
      ? { status: "registered", kickbackRate: new Decimal(kickbackRate) }
      : { status: "unregistered" };
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type MultipleSortedTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapMultipleSortedTrovesToTroves = (
  troves: MultipleSortedTroves
): [string, TroveWithPendingRedistribution][] =>
  troves.map(({ owner, coll, debt, stake, snapshotLUSDDebt, snapshotETH }) => [
    owner,

    new TroveWithPendingRedistribution(
      new Decimal(coll),
      new Decimal(debt),
      new Decimal(stake),
      new Trove(new Decimal(snapshotETH), new Decimal(snapshotLUSDDebt))
    )
  ]);

/**
 * Variant of {@link ReadableEthersLiquity} that exposes a {@link @liquity/lib-base#LiquityStore}.
 *
 * @public
 */
export interface ReadableEthersLiquityWithStore<T extends LiquityStore = LiquityStore>
  extends ReadableEthersLiquity {
  /** An object that implements LiquityStore. */
  readonly store: T;
}

class _BlockPolledReadableEthersLiquity
  extends _CachedReadableLiquity<[overrides?: EthersCallOverrides]>
  implements ReadableEthersLiquityWithStore<BlockPolledLiquityStore> {
  readonly connection: EthersLiquityConnection;
  readonly store: BlockPolledLiquityStore;

  constructor(readable: ReadableEthersLiquity) {
    const store = new BlockPolledLiquityStore(readable);

    super(readable, new _BlockPolledLiquityStoreBasedCache(store));

    this.store = store;
    this.connection = readable.connection;
  }

  hasStore(store?: EthersLiquityStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }
}
