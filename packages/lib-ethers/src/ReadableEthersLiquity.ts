import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";
import {
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRewards
} from "@liquity/lib-base";

import { MultiTroveGetter } from "../types";
import { EthersCallOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";

enum TroveStatus {
  nonExistent,
  active,
  closed
}

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

export class ReadableEthersLiquity extends EthersLiquityBase implements ReadableLiquity {
  async getTotalRedistributed(overrides?: EthersCallOverrides) {
    const [collateral, debt] = await Promise.all([
      this.contracts.troveManager.L_ETH({ ...overrides }).then(decimalify),
      this.contracts.troveManager.L_LUSDDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove({ collateral, debt });
  }

  async getTroveWithoutRewards(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    const [trove, snapshot] = await Promise.all([
      this.contracts.troveManager.Troves(address, { ...overrides }),
      this.contracts.troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (trove.status === TroveStatus.active) {
      return new TroveWithPendingRewards({
        collateral: new Decimal(trove.coll),
        debt: new Decimal(trove.debt),
        stake: new Decimal(trove.stake),

        snapshotOfTotalRedistributed: {
          collateral: new Decimal(snapshot.ETH),
          debt: new Decimal(snapshot.LUSDDebt)
        }
      });
    } else {
      return new TroveWithPendingRewards();
    }
  }

  async getTrove(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRewards(totalRedistributed);
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides) {
    return (await this.contracts.troveManager.getTroveOwnersCount({ ...overrides })).toNumber();
  }

  async getPrice(overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.priceFeed.getPrice({ ...overrides }));
  }

  async getTotal(overrides?: EthersCallOverrides) {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this.contracts.activePool.getETH({ ...overrides }),
        this.contracts.activePool.getLUSDDebt({ ...overrides }),
        this.contracts.defaultPool.getETH({ ...overrides }),
        this.contracts.defaultPool.getLUSDDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove({
      collateral: activeCollateral.add(liquidatedCollateral),
      debt: activeDebt.add(closedDebt)
    });
  }

  async getStabilityDeposit(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    const [depositStruct, depositAfterLoss, pendingCollateralGain] = await Promise.all([
      this.contracts.stabilityPool.deposits(address, { ...overrides }),
      this.contracts.stabilityPool
        .getCompoundedLUSDDeposit(address, { ...overrides })
        .then(decimalify),
      this.contracts.stabilityPool.getDepositorETHGain(address, { ...overrides }).then(decimalify)
    ]);

    const deposit = decimalify(depositStruct.initialValue);

    return new StabilityDeposit({ deposit, depositAfterLoss, pendingCollateralGain });
  }

  async getLUSDInStabilityPool(overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.stabilityPool.getTotalLUSDDeposits({ ...overrides }));
  }

  async getLUSDBalance(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.lusdToken.balanceOf(address, { ...overrides }));
  }

  async getLastTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
    const troves = await this.contracts.multiTroveGetter.getMultipleSortedTroves(
      -(startIdx + 1),
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedTrovesToTroves(troves);
  }

  async getFirstTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
    const troves = await this.contracts.multiTroveGetter.getMultipleSortedTroves(
      startIdx,
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedTrovesToTroves(troves);
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type MultipleSortedTroves = Resolved<ReturnType<MultiTroveGetter["getMultipleSortedTroves"]>>;

const mapMultipleSortedTrovesToTroves = (
  troves: MultipleSortedTroves
): [string, TroveWithPendingRewards][] =>
  troves.map(({ owner, coll, debt, stake, snapshotLUSDDebt, snapshotETH }) => [
    owner,

    new TroveWithPendingRewards({
      collateral: new Decimal(coll),
      debt: new Decimal(debt),
      stake: new Decimal(stake),

      snapshotOfTotalRedistributed: {
        collateral: new Decimal(snapshotETH),
        debt: new Decimal(snapshotLUSDDebt)
      }
    })
  ]);
