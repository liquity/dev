import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";
import {
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRewards
} from "@liquity/lib-base";

import { MultiCDPGetter } from "../types";
import { EthersCallOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";

enum CDPStatus {
  nonExistent,
  active,
  closed
}

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

export class ReadableEthersLiquity extends EthersLiquityBase implements ReadableLiquity {
  async getTotalRedistributed(overrides?: EthersCallOverrides) {
    const [collateral, debt] = await Promise.all([
      this.contracts.troveManager.L_ETH({ ...overrides }).then(decimalify),
      this.contracts.troveManager.L_CLVDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove({ collateral, debt });
  }

  async getTroveWithoutRewards(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    const [cdp, snapshot] = await Promise.all([
      this.contracts.troveManager.CDPs(address, { ...overrides }),
      this.contracts.troveManager.rewardSnapshots(address, { ...overrides })
    ]);

    if (cdp.status === CDPStatus.active) {
      return new TroveWithPendingRewards({
        collateral: new Decimal(cdp.coll),
        debt: new Decimal(cdp.debt),
        stake: new Decimal(cdp.stake),

        snapshotOfTotalRedistributed: {
          collateral: new Decimal(snapshot.ETH),
          debt: new Decimal(snapshot.CLVDebt)
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
    return (await this.contracts.troveManager.getCDPOwnersCount({ ...overrides })).toNumber();
  }

  async getPrice(overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.priceFeed.getPrice({ ...overrides }));
  }

  async getTotal(overrides?: EthersCallOverrides) {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this.contracts.activePool.getETH({ ...overrides }),
        this.contracts.activePool.getCLVDebt({ ...overrides }),
        this.contracts.defaultPool.getETH({ ...overrides }),
        this.contracts.defaultPool.getCLVDebt({ ...overrides })
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
        .getCompoundedCLVDeposit(address, { ...overrides })
        .then(decimalify),
      this.contracts.stabilityPool.getDepositorETHGain(address, { ...overrides }).then(decimalify)
    ]);

    const deposit = decimalify(depositStruct.initialValue);

    return new StabilityDeposit({ deposit, depositAfterLoss, pendingCollateralGain });
  }

  async getQuiInStabilityPool(overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.stabilityPool.getTotalCLVDeposits({ ...overrides }));
  }

  async getQuiBalance(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    return new Decimal(await this.contracts.clvToken.balanceOf(address, { ...overrides }));
  }

  async getLastTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
    const cdps = await this.contracts.multiCDPgetter.getMultipleSortedCDPs(
      -(startIdx + 1),
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedCDPsToTroves(cdps);
  }

  async getFirstTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
    const cdps = await this.contracts.multiCDPgetter.getMultipleSortedCDPs(
      startIdx,
      numberOfTroves,
      { ...overrides }
    );

    return mapMultipleSortedCDPsToTroves(cdps);
  }
}

type Resolved<T> = T extends Promise<infer U> ? U : T;
type MultipleSortedCDPs = Resolved<ReturnType<MultiCDPGetter["getMultipleSortedCDPs"]>>;

const mapMultipleSortedCDPsToTroves = (cdps: MultipleSortedCDPs) =>
  cdps.map(
    ({ owner, coll, debt, stake, snapshotCLVDebt, snapshotETH }) =>
      [
        owner,

        new TroveWithPendingRewards({
          collateral: new Decimal(coll),
          debt: new Decimal(debt),
          stake: new Decimal(stake),

          snapshotOfTotalRedistributed: {
            collateral: new Decimal(snapshotETH),
            debt: new Decimal(snapshotCLVDebt)
          }
        })
      ] as const
  );
