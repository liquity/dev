import { BlockTag } from "@ethersproject/abstract-provider";

import {
  Decimal,
  Fees,
  FrontendStatus,
  StabilioStore,
  STBLStake,
  ReadableStabilio,
  StabilityDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove,
  UserTroveStatus
} from "@stabilio/lib-base";

import { MultiTroveGetter } from "../types";

import { decimalify, numberify, panic } from "./_utils";
import { EthersCallOverrides, EthersProvider, EthersSigner } from "./types";

import {
  EthersStabilioConnection,
  EthersStabilioConnectionOptionalParams,
  EthersStabilioStoreOption,
  _connect,
  _getBlockTimestamp,
  _getContracts,
  _requireAddress,
  _requireFrontendAddress
} from "./EthersStabilioConnection";

import { BlockPolledStabilioStore } from "./BlockPolledStabilioStore";

// TODO: these are constant in the contracts, so it doesn't make sense to make a call for them,
// but to avoid having to update them here when we change them in the contracts, we could read
// them once after deployment and save them to StabilioDeployment.
const MINUTE_DECAY_FACTOR = Decimal.from("0.999037758833783000");
const BETA = Decimal.from(2);

enum BackendTroveStatus {
  nonExistent,
  active,
  closedByOwner,
  closedByLiquidation,
  closedByRedemption
}

const userTroveStatusFrom = (backendStatus: BackendTroveStatus): UserTroveStatus =>
  backendStatus === BackendTroveStatus.nonExistent
    ? "nonExistent"
    : backendStatus === BackendTroveStatus.active
    ? "open"
    : backendStatus === BackendTroveStatus.closedByOwner
    ? "closedByOwner"
    : backendStatus === BackendTroveStatus.closedByLiquidation
    ? "closedByLiquidation"
    : backendStatus === BackendTroveStatus.closedByRedemption
    ? "closedByRedemption"
    : panic(new Error(`invalid backendStatus ${backendStatus}`));

const convertToDate = (timestamp: number) => new Date(timestamp * 1000);

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
 * Ethers-based implementation of {@link @stabilio/lib-base#ReadableStabilio}.
 *
 * @public
 */
export class ReadableEthersStabilio implements ReadableStabilio {
  readonly connection: EthersStabilioConnection;

  /** @internal */
  constructor(connection: EthersStabilioConnection) {
    this.connection = connection;
  }

  /** @internal */
  static _from(
    connection: EthersStabilioConnection & { useStore: "blockPolled" }
  ): ReadableEthersStabilioWithStore<BlockPolledStabilioStore>;

  /** @internal */
  static _from(connection: EthersStabilioConnection): ReadableEthersStabilio;

  /** @internal */
  static _from(connection: EthersStabilioConnection): ReadableEthersStabilio {
    const readable = new ReadableEthersStabilio(connection);

    return connection.useStore === "blockPolled"
      ? new _BlockPolledReadableEthersStabilio(readable)
      : readable;
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersStabilioConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<ReadableEthersStabilioWithStore<BlockPolledStabilioStore>>;

  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersStabilioConnectionOptionalParams
  ): Promise<ReadableEthersStabilio>;

  /**
   * Connect to the Stabilio protocol and create a `ReadableEthersStabilio` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersStabilioConnectionOptionalParams
  ): Promise<ReadableEthersStabilio> {
    return ReadableEthersStabilio._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `ReadableEthersStabilio` is a {@link ReadableEthersStabilioWithStore}.
   */
  hasStore(): this is ReadableEthersStabilioWithStore;

  /**
   * Check whether this `ReadableEthersStabilio` is a
   * {@link ReadableEthersStabilioWithStore}\<{@link BlockPolledStabilioStore}\>.
   */
  hasStore(store: "blockPolled"): this is ReadableEthersStabilioWithStore<BlockPolledStabilioStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this.connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_ETH({ ...overrides }).then(decimalify),
      troveManager.L_XBRLDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTroveBeforeRedistribution} */
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

    if (trove.status === BackendTroveStatus.active) {
      return new TroveWithPendingRedistribution(
        address,
        userTroveStatusFrom(trove.status),
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(snapshot.ETH), decimalify(snapshot.XBRLDebt))
      );
    } else {
      return new TroveWithPendingRedistribution(address, userTroveStatusFrom(trove.status));
    }
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTrove} */
  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address, overrides),
      this.getTotalRedistributed(overrides)
    ]);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getNumberOfTroves} */
  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this.connection);

    return (await troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this.connection);

    return priceFeed.callStatic.fetchPrice({ ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getActivePool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool } = _getContracts(this.connection);

    const [activeCollateral, activeDebt] = await Promise.all(
      [
        activePool.getETH({ ...overrides }),
        activePool.getXBRLDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral, activeDebt);
  }

  /** @internal */
  async _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove> {
    const { defaultPool } = _getContracts(this.connection);

    const [liquidatedCollateral, closedDebt] = await Promise.all(
      [
        defaultPool.getETH({ ...overrides }),
        defaultPool.getXBRLDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(liquidatedCollateral, closedDebt);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const [activePool, defaultPool] = await Promise.all([
      this._getActivePool(overrides),
      this._getDefaultPool(overrides)
    ]);

    return activePool.add(defaultPool);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getStabilityDeposit} */
  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    address ??= _requireAddress(this.connection);
    const { stabilityPool } = _getContracts(this.connection);

    const [
      { frontEndTag, initialValue },
      currentXBRL,
      collateralGain,
      stblReward
    ] = await Promise.all([
      stabilityPool.deposits(address, { ...overrides }),
      stabilityPool.getCompoundedXBRLDeposit(address, { ...overrides }),
      stabilityPool.getDepositorETHGain(address, { ...overrides }),
      stabilityPool.getDepositorSTBLGain(address, { ...overrides })
    ]);

    return new StabilityDeposit(
      decimalify(initialValue),
      decimalify(currentXBRL),
      decimalify(collateralGain),
      decimalify(stblReward),
      frontEndTag
    );
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingStabilityPoolSTBLReward} */
  async getRemainingStabilityPoolSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { communityIssuance } = _getContracts(this.connection);

    const issuanceCap = this.connection.totalStabilityPoolSTBLReward;
    const totalSTBLIssued = decimalify(await communityIssuance.totalSTBLIssued({ ...overrides }));

    // totalSTBLIssued approaches but never reaches issuanceCap
    return issuanceCap.sub(totalSTBLIssued);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXBRLInStabilityPool} */
  getXBRLInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stabilityPool } = _getContracts(this.connection);

    return stabilityPool.getTotalXBRLDeposits({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXBRLBalance} */
  getXBRLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlToken } = _getContracts(this.connection);

    return xbrlToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getSTBLBalance} */
  getSTBLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { stblToken } = _getContracts(this.connection);

    return stblToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethUniTokenBalance} */
  getXbrlWethUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlWethUniToken } = _getContracts(this.connection);

    return xbrlWethUniToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethUniTokenAllowance} */
  getXbrlWethUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlWethUniToken, xbrlWethUnipool } = _getContracts(this.connection);

    return xbrlWethUniToken.allowance(address, xbrlWethUnipool.address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    const { xbrlWethUnipool } = _getContracts(this.connection);

    const [totalSupply, rewardRate, periodFinish, lastUpdateTime] = await Promise.all([
      xbrlWethUnipool.totalSupply({ ...overrides }),
      xbrlWethUnipool.rewardRate({ ...overrides }).then(decimalify),
      xbrlWethUnipool.periodFinish({ ...overrides }).then(numberify),
      xbrlWethUnipool.lastUpdateTime({ ...overrides }).then(numberify)
    ]);

    return (blockTimestamp: number) =>
      rewardRate.mul(
        Math.max(0, periodFinish - (totalSupply.isZero() ? lastUpdateTime : blockTimestamp))
      );
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingXbrlWethLiquidityMiningSTBLReward} */
  async getRemainingXbrlWethLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const [calculateRemainingSTBLInXbrlWethLiquidityPool, blockTimestamp] = await Promise.all([
      this._getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return calculateRemainingSTBLInXbrlWethLiquidityPool(blockTimestamp);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethLiquidityMiningStake} */
  getXbrlWethLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlWethUnipool } = _getContracts(this.connection);

    return xbrlWethUnipool.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedXbrlWethUniTokens} */
  getTotalStakedXbrlWethUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { xbrlWethUnipool } = _getContracts(this.connection);

    return xbrlWethUnipool.totalSupply({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethLiquidityMiningSTBLReward} */
  getXbrlWethLiquidityMiningSTBLReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlWethUnipool } = _getContracts(this.connection);

    return xbrlWethUnipool.earned(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblUniTokenBalance} */
  getXbrlStblUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlStblUniToken } = _getContracts(this.connection);

    return xbrlStblUniToken.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblUniTokenAllowance} */
  getXbrlStblUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlStblUniToken, xbrlStblUnipool } = _getContracts(this.connection);

    return xbrlStblUniToken.allowance(address, xbrlStblUnipool.address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  async _getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    const { xbrlStblUnipool } = _getContracts(this.connection);

    const [totalSupply, rewardRate, periodFinish, lastUpdateTime] = await Promise.all([
      xbrlStblUnipool.totalSupply({ ...overrides }),
      xbrlStblUnipool.rewardRate({ ...overrides }).then(decimalify),
      xbrlStblUnipool.periodFinish({ ...overrides }).then(numberify),
      xbrlStblUnipool.lastUpdateTime({ ...overrides }).then(numberify)
    ]);

    return (blockTimestamp: number) =>
      rewardRate.mul(
        Math.max(0, periodFinish - (totalSupply.isZero() ? lastUpdateTime : blockTimestamp))
      );
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingXbrlStblLiquidityMiningSTBLReward} */
  async getRemainingXbrlStblLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    const [calculateRemainingSTBLInXbrlStblLiquidityPool, blockTimestamp] = await Promise.all([
      this._getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return calculateRemainingSTBLInXbrlStblLiquidityPool(blockTimestamp);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblLiquidityMiningStake} */
  getXbrlStblLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlStblUnipool } = _getContracts(this.connection);

    return xbrlStblUnipool.balanceOf(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedXbrlStblUniTokens} */
  getTotalStakedXbrlStblUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { xbrlStblUnipool } = _getContracts(this.connection);

    return xbrlStblUnipool.totalSupply({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblLiquidityMiningSTBLReward} */
  getXbrlStblLiquidityMiningSTBLReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { xbrlStblUnipool } = _getContracts(this.connection);

    return xbrlStblUnipool.earned(address, { ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    address ??= _requireAddress(this.connection);
    const { collSurplusPool } = _getContracts(this.connection);

    return collSurplusPool.getCollateral(address, { ...overrides }).then(decimalify);
  }

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.(getTroves:2)} */
  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  async getTroves(
    params: TroveListingParams,
    overrides?: EthersCallOverrides
  ): Promise<UserTrove[]> {
    const { multiTroveGetter } = _getContracts(this.connection);

    expectPositiveInt(params, "first");
    expectPositiveInt(params, "startingAt");

    if (!validSortingOptions.includes(params.sortedBy)) {
      throw new Error(
        `sortedBy must be one of: ${validSortingOptions.map(x => `"${x}"`).join(", ")}`
      );
    }

    const [totalRedistributed, backendTroves] = await Promise.all([
      params.beforeRedistribution ? undefined : this.getTotalRedistributed({ ...overrides }),
      multiTroveGetter.getMultipleSortedTroves(
        params.sortedBy === "descendingCollateralRatio"
          ? params.startingAt ?? 0
          : -((params.startingAt ?? 0) + 1),
        params.first,
        { ...overrides }
      )
    ]);

    const troves = mapBackendTroves(backendTroves);

    if (totalRedistributed) {
      return troves.map(trove => trove.applyRedistribution(totalRedistributed));
    } else {
      return troves;
    }
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return _getBlockTimestamp(this.connection, blockTag);
  }

  /** @internal */
  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    const { troveManager } = _getContracts(this.connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    return (blockTimestamp, recoveryMode) =>
      new Fees(
        baseRateWithoutDecay,
        MINUTE_DECAY_FACTOR,
        BETA,
        convertToDate(lastFeeOperationTime.toNumber()),
        convertToDate(blockTimestamp),
        recoveryMode
      );
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const [createFees, total, price, blockTimestamp] = await Promise.all([
      this._getFeesFactory(overrides),
      this.getTotal(overrides),
      this.getPrice(overrides),
      this._getBlockTimestamp(overrides?.blockTag)
    ]);

    return createFees(blockTimestamp, total.collateralRatioIsBelowCritical(price));
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getSTBLStake} */
  async getSTBLStake(address?: string, overrides?: EthersCallOverrides): Promise<STBLStake> {
    address ??= _requireAddress(this.connection);
    const { stblStaking } = _getContracts(this.connection);

    const [stakedSTBL, collateralGain, xbrlGain] = await Promise.all(
      [
        stblStaking.stakes(address, { ...overrides }),
        stblStaking.getPendingETHGain(address, { ...overrides }),
        stblStaking.getPendingXBRLGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new STBLStake(stakedSTBL, collateralGain, xbrlGain);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedSTBL} */
  async getTotalStakedSTBL(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { stblStaking } = _getContracts(this.connection);

    return stblStaking.totalSTBLStaked({ ...overrides }).then(decimalify);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getFrontendStatus} */
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
type BackendTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapBackendTroves = (troves: BackendTroves): TroveWithPendingRedistribution[] =>
  troves.map(
    trove =>
      new TroveWithPendingRedistribution(
        trove.owner,
        "open", // These Troves are coming from the SortedTroves list, so they must be open
        decimalify(trove.coll),
        decimalify(trove.debt),
        decimalify(trove.stake),
        new Trove(decimalify(trove.snapshotETH), decimalify(trove.snapshotXBRLDebt))
      )
  );

/**
 * Variant of {@link ReadableEthersStabilio} that exposes a {@link @stabilio/lib-base#StabilioStore}.
 *
 * @public
 */
export interface ReadableEthersStabilioWithStore<T extends StabilioStore = StabilioStore>
  extends ReadableEthersStabilio {
  /** An object that implements StabilioStore. */
  readonly store: T;
}

class _BlockPolledReadableEthersStabilio
  implements ReadableEthersStabilioWithStore<BlockPolledStabilioStore> {
  readonly connection: EthersStabilioConnection;
  readonly store: BlockPolledStabilioStore;

  private readonly _readable: ReadableEthersStabilio;

  constructor(readable: ReadableEthersStabilio) {
    const store = new BlockPolledStabilioStore(readable);

    this.store = store;
    this.connection = readable.connection;
    this._readable = readable;
  }

  private _blockHit(overrides?: EthersCallOverrides): boolean {
    return (
      !overrides ||
      overrides.blockTag === undefined ||
      overrides.blockTag === this.store.state.blockTag
    );
  }

  private _userHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.userAddress)
    );
  }

  private _frontendHit(address?: string, overrides?: EthersCallOverrides): boolean {
    return (
      this._blockHit(overrides) &&
      (address === undefined || address === this.store.connection.frontendTag)
    );
  }

  hasStore(store?: EthersStabilioStoreOption): boolean {
    return store === undefined || store === "blockPolled";
  }

  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides)
      ? this.store.state.totalRedistributed
      : this._readable.getTotalRedistributed(overrides);
  }

  async getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    return this._userHit(address, overrides)
      ? this.store.state.troveBeforeRedistribution
      : this._readable.getTroveBeforeRedistribution(address, overrides);
  }

  async getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    return this._userHit(address, overrides)
      ? this.store.state.trove
      : this._readable.getTrove(address, overrides);
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    return this._blockHit(overrides)
      ? this.store.state.numberOfTroves
      : this._readable.getNumberOfTroves(overrides);
  }

  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides) ? this.store.state.price : this._readable.getPrice(overrides);
  }

  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._blockHit(overrides) ? this.store.state.total : this._readable.getTotal(overrides);
  }

  async getStabilityDeposit(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    return this._userHit(address, overrides)
      ? this.store.state.stabilityDeposit
      : this._readable.getStabilityDeposit(address, overrides);
  }

  async getRemainingStabilityPoolSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingStabilityPoolSTBLReward
      : this._readable.getRemainingStabilityPoolSTBLReward(overrides);
  }

  async getXBRLInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.xbrlInStabilityPool
      : this._readable.getXBRLInStabilityPool(overrides);
  }

  async getXBRLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlBalance
      : this._readable.getXBRLBalance(address, overrides);
  }

  async getSTBLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.stblBalance
      : this._readable.getSTBLBalance(address, overrides);
  }

  async getXbrlWethUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlWethUniTokenBalance
      : this._readable.getXbrlWethUniTokenBalance(address, overrides);
  }

  async getXbrlWethUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlWethUniTokenAllowance
      : this._readable.getXbrlWethUniTokenAllowance(address, overrides);
  }

  async getRemainingXbrlWethLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingXbrlWethLiquidityMiningSTBLReward
      : this._readable.getRemainingXbrlWethLiquidityMiningSTBLReward(overrides);
  }

  async getXbrlWethLiquidityMiningStake(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlWethLiquidityMiningStake
      : this._readable.getXbrlWethLiquidityMiningStake(address, overrides);
  }

  async getTotalStakedXbrlWethUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedXbrlWethUniTokens
      : this._readable.getTotalStakedXbrlWethUniTokens(overrides);
  }

  async getXbrlWethLiquidityMiningSTBLReward(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlWethLiquidityMiningSTBLReward
      : this._readable.getXbrlWethLiquidityMiningSTBLReward(address, overrides);
  }

  async getXbrlStblUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlStblUniTokenBalance
      : this._readable.getXbrlStblUniTokenBalance(address, overrides);
  }

  async getXbrlStblUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlStblUniTokenAllowance
      : this._readable.getXbrlStblUniTokenAllowance(address, overrides);
  }

  async getRemainingXbrlStblLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.remainingXbrlStblLiquidityMiningSTBLReward
      : this._readable.getRemainingXbrlStblLiquidityMiningSTBLReward(overrides);
  }

  async getXbrlStblLiquidityMiningStake(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlStblLiquidityMiningStake
      : this._readable.getXbrlStblLiquidityMiningStake(address, overrides);
  }

  async getTotalStakedXbrlStblUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedXbrlStblUniTokens
      : this._readable.getTotalStakedXbrlStblUniTokens(overrides);
  }

  async getXbrlStblLiquidityMiningSTBLReward(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.xbrlStblLiquidityMiningSTBLReward
      : this._readable.getXbrlStblLiquidityMiningSTBLReward(address, overrides);
  }

  async getCollateralSurplusBalance(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return this._userHit(address, overrides)
      ? this.store.state.collateralSurplusBalance
      : this._readable.getCollateralSurplusBalance(address, overrides);
  }

  async _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._blockHit({ blockTag })
      ? this.store.state.blockTimestamp
      : this._readable._getBlockTimestamp(blockTag);
  }

  async _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._blockHit(overrides)
      ? this.store.state._feesFactory
      : this._readable._getFeesFactory(overrides);
  }

  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    return this._blockHit(overrides) ? this.store.state.fees : this._readable.getFees(overrides);
  }

  async getSTBLStake(address?: string, overrides?: EthersCallOverrides): Promise<STBLStake> {
    return this._userHit(address, overrides)
      ? this.store.state.stblStake
      : this._readable.getSTBLStake(address, overrides);
  }

  async getTotalStakedSTBL(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._blockHit(overrides)
      ? this.store.state.totalStakedSTBL
      : this._readable.getTotalStakedSTBL(overrides);
  }

  async getFrontendStatus(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    return this._frontendHit(address, overrides)
      ? this.store.state.frontend
      : this._readable.getFrontendStatus(address, overrides);
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]> {
    return this._readable.getTroves(params, overrides);
  }

  _getActivePool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getDefaultPool(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  _getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator(): Promise<(blockTimestamp: number) => Decimal> {
    throw new Error("Method not implemented.");
  }

  _getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator(): Promise<(blockTimestamp: number) => Decimal> {
    throw new Error("Method not implemented.");
  }
}
