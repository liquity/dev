import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";
import {
  Fees,
  FrontendStatus,
  LQTYStake,
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";
import { EthersCallOverrides } from "./types";
import { _EthersLiquityBase } from "./EthersLiquityBase";
import { LiquityConnection, _getContracts } from "./contracts";

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
export class ReadableEthersLiquity extends _EthersLiquityBase implements ReadableLiquity {
  constructor(connection: LiquityConnection, userAddress?: string) {
    super(connection, userAddress);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotalRedistributed} */
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const { troveManager } = _getContracts(this._connection);

    const [collateral, debt] = await Promise.all([
      troveManager.L_ETH({ ...overrides }).then(decimalify),
      troveManager.L_LUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTroveWithoutRewards} */
  async getTroveWithoutRewards(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    const { troveManager } = _getContracts(this._connection);

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
  async getTrove(address = this._requireAddress(), overrides?: EthersCallOverrides): Promise<Trove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRedistribution(totalRedistributed);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getNumberOfTroves} */
  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    const { troveManager } = _getContracts(this._connection);

    return (await troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getPrice} */
  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    const { priceFeed } = _getContracts(this._connection);

    return new Decimal(await priceFeed.callStatic.fetchPrice({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getTotal} */
  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const { activePool, defaultPool } = _getContracts(this._connection);

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
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    const { stabilityPool } = _getContracts(this._connection);

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
    const { stabilityPool } = _getContracts(this._connection);

    return new Decimal(await stabilityPool.getTotalLUSDDeposits({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLUSDBalance} */
  async getLUSDBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    const { lusdToken } = _getContracts(this._connection);

    return new Decimal(await lusdToken.balanceOf(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLQTYBalance} */
  async getLQTYBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    const { lqtyToken } = _getContracts(this._connection);

    return new Decimal(await lqtyToken.balanceOf(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getCollateralSurplusBalance} */
  async getCollateralSurplusBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    const { collSurplusPool } = _getContracts(this._connection);

    return new Decimal(await collSurplusPool.getCollateral(address, { ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLastTroves} */
  async getLastTroves(
    startIdx: number,
    numberOfTroves: number,
    overrides?: EthersCallOverrides
  ): Promise<[string, TroveWithPendingRedistribution][]> {
    const { multiTroveGetter } = _getContracts(this._connection);

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
    const { multiTroveGetter } = _getContracts(this._connection);

    const troves = await multiTroveGetter.getMultipleSortedTroves(startIdx, numberOfTroves, {
      ...overrides
    });

    return mapMultipleSortedTrovesToTroves(troves);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFees} */
  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const { troveManager } = _getContracts(this._connection);

    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      troveManager.lastFeeOperationTime({ ...overrides }),
      troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    const lastFeeOperation = new Date(1000 * lastFeeOperationTime.toNumber());

    return new Fees(lastFeeOperation, baseRateWithoutDecay, MINUTE_DECAY_FACTOR, BETA);
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getLQTYStake} */
  async getLQTYStake(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<LQTYStake> {
    const { lqtyStaking } = _getContracts(this._connection);

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
    const { lqtyStaking } = _getContracts(this._connection);

    return new Decimal(await lqtyStaking.totalLQTYStaked({ ...overrides }));
  }

  /** {@inheritDoc @liquity/lib-base#ReadableLiquity.getFrontendStatus} */
  async getFrontendStatus(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    const { stabilityPool } = _getContracts(this._connection);

    const { registered, kickbackRate } = await stabilityPool.frontEnds(address, {
      ...overrides
    });

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
