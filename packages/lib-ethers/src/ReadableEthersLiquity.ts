import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";
import {
  Fees,
  FrontendStatus,
  LQTYStake,
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRewards
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";
import { EthersCallOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";

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

export class ReadableEthersLiquity extends EthersLiquityBase implements ReadableLiquity {
  async getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    const [collateral, debt] = await Promise.all([
      this._contracts.troveManager.L_ETH({ ...overrides }).then(decimalify),
      this._contracts.troveManager.L_LUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove(collateral, debt);
  }

  async getTroveWithoutRewards(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRewards> {
    const [trove, snapshot] = await Promise.all([
      this._contracts.troveManager.Troves(address, { ...overrides }),
      this._contracts.troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (trove.status === TroveStatus.active) {
      return new TroveWithPendingRewards(
        new Decimal(trove.coll),
        new Decimal(trove.debt),
        new Decimal(trove.stake),
        new Trove(new Decimal(snapshot.ETH), new Decimal(snapshot.LUSDDebt))
      );
    } else {
      return new TroveWithPendingRewards();
    }
  }

  async getTrove(address = this._requireAddress(), overrides?: EthersCallOverrides): Promise<Trove> {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRewards(totalRedistributed);
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    return (await this._contracts.troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  async getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return new Decimal(await this._contracts.priceFeed.getPrice({ ...overrides }));
  }

  async getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this._contracts.activePool.getETH({ ...overrides }),
        this._contracts.activePool.getLUSDDebt({ ...overrides }),
        this._contracts.defaultPool.getETH({ ...overrides }),
        this._contracts.defaultPool.getLUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove(activeCollateral.add(liquidatedCollateral), activeDebt.add(closedDebt));
  }

  async getStabilityDeposit(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<StabilityDeposit> {
    const [initialLUSD, currentLUSD, collateralGain, lqtyReward] = await Promise.all(
      [
        this._contracts.stabilityPool.deposits(address, { ...overrides }).then(d => d.initialValue),
        this._contracts.stabilityPool.getCompoundedLUSDDeposit(address, { ...overrides }),
        this._contracts.stabilityPool.getDepositorETHGain(address, { ...overrides }),
        this._contracts.stabilityPool.getDepositorLQTYGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new StabilityDeposit(initialLUSD, currentLUSD, collateralGain, lqtyReward);
  }

  async getLUSDInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return new Decimal(await this._contracts.stabilityPool.getTotalLUSDDeposits({ ...overrides }));
  }

  async getLUSDBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return new Decimal(await this._contracts.lusdToken.balanceOf(address, { ...overrides }));
  }

  async getLQTYBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return new Decimal(await this._contracts.lqtyToken.balanceOf(address, { ...overrides }));
  }

  async getCollateralSurplusBalance(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<Decimal> {
    return new Decimal(
      await this._contracts.collSurplusPool.getCollateral(address, { ...overrides })
    );
  }

  async getLastTroves(
    startIdx: number,
    numberOfTroves: number,
    overrides?: EthersCallOverrides
  ): Promise<[string, TroveWithPendingRewards][]> {
    const troves = await this._contracts.multiTroveGetter.getMultipleSortedTroves(
      -(startIdx + 1),
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedTrovesToTroves(troves);
  }

  async getFirstTroves(
    startIdx: number,
    numberOfTroves: number,
    overrides?: EthersCallOverrides
  ): Promise<[string, TroveWithPendingRewards][]> {
    const troves = await this._contracts.multiTroveGetter.getMultipleSortedTroves(
      startIdx,
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedTrovesToTroves(troves);
  }

  async getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    const [lastFeeOperationTime, baseRateWithoutDecay] = await Promise.all([
      this._contracts.troveManager.lastFeeOperationTime({ ...overrides }),
      this._contracts.troveManager.baseRate({ ...overrides }).then(decimalify)
    ]);

    const lastFeeOperation = new Date(1000 * lastFeeOperationTime.toNumber());

    return new Fees(lastFeeOperation, baseRateWithoutDecay, MINUTE_DECAY_FACTOR, BETA);
  }

  async getLQTYStake(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<LQTYStake> {
    const [stakedLQTY, collateralGain, lusdGain] = await Promise.all(
      [
        this._contracts.lqtyStaking.stakes(address, { ...overrides }),
        this._contracts.lqtyStaking.getPendingETHGain(address, { ...overrides }),
        this._contracts.lqtyStaking.getPendingLUSDGain(address, { ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new LQTYStake(stakedLQTY, collateralGain, lusdGain);
  }

  async getTotalStakedLQTY(overrides?: EthersCallOverrides): Promise<Decimal> {
    return new Decimal(await this._contracts.lqtyStaking.totalLQTYStaked({ ...overrides }));
  }

  async getFrontendStatus(
    address = this._requireAddress(),
    overrides?: EthersCallOverrides
  ): Promise<FrontendStatus> {
    const { registered, kickbackRate } = await this._contracts.stabilityPool.frontEnds(address, {
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
): [string, TroveWithPendingRewards][] =>
  troves.map(({ owner, coll, debt, stake, snapshotLUSDDebt, snapshotETH }) => [
    owner,

    new TroveWithPendingRewards(
      new Decimal(coll),
      new Decimal(debt),
      new Decimal(stake),
      new Trove(new Decimal(snapshotETH), new Decimal(snapshotLUSDDebt))
    )
  ]);
