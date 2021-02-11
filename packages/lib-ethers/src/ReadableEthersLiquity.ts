import { BigNumber } from "@ethersproject/bignumber";

import {
  Decimal,
  Fees,
  FrontendStatus,
  LiquityStore,
  LQTYStake,
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  _CachedReadableLiquity,
  _LiquityReadCache
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

import { BlockPolledLiquityStore } from "./BlockPolledLiquityStore";

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

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());

const validSortingOptions = ["ascendingCollateralRatio", "descendingCollateralRatio"];

const expectPositiveInt = <K extends string>(obj: { [P in K]?: number }, key: K) => {
  if (obj[key] !== undefined) {
    if (!Number.isInteger(obj[key])) {
      throw new Error(`${key} must be an integer`);
    }

    if (obj[key] < 0) {
      throw new Error(`${key} must not be negative`);
    }
  }
};

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
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(snapshot.ETH), decimalify(snapshot.LUSDDebt))
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
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    // fetchPrice() fails when called through BatchedProvider, because that uses a helper contract
    // that dispatches batched calls using STATICCALL, and fetchPrice() tries to modify state, which
    // "will result in an exception instead of performing the modification" (EIP-214).

    // Passing a pointless gasPrice override ensures that the call is performed directly --
    // bypassing the helper contract -- because BatchedProvider has no support for overrides other
    // than blockTag.
    return priceFeed.callStatic.fetchPrice({ ...overrides, gasPrice: 0 }).then(decimalify);
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
  getLUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalLUSDDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLUSDBalance} */
  getLUSDBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { lusdToken } = _getContracts(this.connection);

    return lusdToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLQTYBalance} */
  getLQTYBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { lqtyToken } = _getContracts(this.connection);

    return lqtyToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool.getCollateral(address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<[address: string, trove: TroveWithPendingRedistribution][]>;

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.(getTroves:2)} */
  getTroves(
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<[address: string, trove: Trove][]>;

  async getTroves(
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<[address: string, trove: Trove][]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, rawTroves] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed({ ...overrides }),
      multiTroveGetter.getMultipleSortedTroves(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const troves = mapRawTrovesToTroves(rawTroves);

    if (totalRedistributed) {
      return troves.map(([address, trove]) => [
        address,
        trove.applyRedistribution(totalRedistributed)
      ]);
    } else {
      return troves;
    }
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

    return lqtyStaking.totalLQTYStaked({ ...overrides }).then(decimalify);
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
      ? { status: "registered", kickbackRate: decimalify(kickbackRate) }
      : { status: "unregistered" };
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type RawTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapRawTrovesToTroves = (troves: RawTroves): [string, TroveWithPendingRedistribution][] =>
  troves.map(({ owner, coll, debt, stake, snapshotLUSDDebt, snapshotETH }) => [
    owner,

    new TroveWithPendingRedistribution(
      decimalify(coll),
      decimalify(debt),
      decimalify(stake),
      new Trove(decimalify(snapshotETH), decimalify(snapshotLUSDDebt))
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

class BlockPolledLiquityStoreBasedCache
  implements _LiquityReadCache<[overrides?: EthersCallOverrides]> {
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

  getTroves() {
    return undefined;
  }
}

class _BlockPolledReadableEthersLiquity
  extends _CachedReadableLiquity<[overrides?: EthersCallOverrides]>
  implements ReadableEthersLiquityWithStore<BlockPolledLiquityStore> {
  readonly connection: EthersLiquityConnection;
  readonly store: BlockPolledLiquityStore;

  constructor(readable: ReadableEthersLiquity) {
    const store = new BlockPolledLiquityStore(readable);

    super(readable, new BlockPolledLiquityStoreBasedCache(store));

    this.store = store;
    this.connection = readable.connection;
  }

  hasStore(store?: EthersLiquityStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }
}
