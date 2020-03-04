import { Signer } from "ethers";
import { Web3Provider, Provider } from "ethers/providers";
import { bigNumberify, BigNumber, BigNumberish } from "ethers/utils";

import { Decimal, Decimalish } from "../utils/Decimal";

import { CDPManager } from "../types/CDPManager";
import { CDPManagerFactory } from "../types/CDPManagerFactory";
import { ISortedCDPs } from "../types/ISortedCDPs";
import { ISortedCDPsFactory } from "../types/ISortedCDPsFactory";
import { IPriceFeed } from "../types/IPriceFeed";
import { IPriceFeedFactory } from "../types/IPriceFeedFactory";
import { IPoolManager } from "../types/IPoolManager";
import { IPoolManagerFactory } from "../types/IPoolManagerFactory";

interface Poolish {
  readonly activeCollateral: Decimalish;
  readonly activeDebt: Decimalish;
  readonly liquidatedCollateral: Decimalish;
  readonly closedDebt: Decimalish;
}

export class Pool {
  readonly activeCollateral: Decimal;
  readonly activeDebt: Decimal;
  readonly liquidatedCollateral: Decimal;
  readonly closedDebt: Decimal;

  constructor({ activeCollateral, activeDebt, liquidatedCollateral, closedDebt }: Poolish) {
    this.activeCollateral = Decimal.from(activeCollateral);
    this.activeDebt = Decimal.from(activeDebt);
    this.liquidatedCollateral = Decimal.from(liquidatedCollateral);
    this.closedDebt = Decimal.from(closedDebt);
  }

  get totalCollateral() {
    return this.activeCollateral.add(this.liquidatedCollateral);
  }

  get totalDebt() {
    return this.activeDebt.add(this.closedDebt);
  }

  totalCollateralRatioAt(price: Decimalish) {
    return calculateCollateralRatio(this.totalCollateral, this.totalDebt, price);
  }

  isRecoveryModeActiveAt(price: Decimalish) {
    return this.totalCollateralRatioAt(price).lt(1.5);
  }
}

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
  readonly pendingCollateralReward?: Decimalish;
  readonly pendingDebtReward?: Decimalish;
}

const calculateCollateralRatio = (collateral: Decimal, debt: Decimal, price: Decimalish) => {
  if (debt.isZero()) {
    return Decimal.INFINITY;
  }
  return collateral.mulDiv(price, debt);
};

export class Trove {
  readonly collateral: Decimal;
  readonly debt: Decimal;
  readonly pendingCollateralReward: Decimal;
  readonly pendingDebtReward: Decimal;

  collateralRatioAt(price: Decimalish): Decimal {
    return calculateCollateralRatio(this.collateral, this.debt, price);
  }

  collateralRatioAfterRewardsAt(price: Decimalish): Decimal {
    const collateralAfterRewards = this.collateral.add(this.pendingCollateralReward);
    const debtAfterRewards = this.debt.add(this.pendingDebtReward);

    return calculateCollateralRatio(collateralAfterRewards, debtAfterRewards, price);
  }

  isBelowMinimumCollateralRatioAt(price: Decimalish) {
    return this.collateralRatioAfterRewardsAt(price).lt(1.1);
  }

  constructor({
    collateral = 0,
    debt = 0,
    pendingCollateralReward = 0,
    pendingDebtReward = 0
  }: Trovish = {}) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
    this.pendingCollateralReward = Decimal.from(pendingCollateralReward);
    this.pendingDebtReward = Decimal.from(pendingDebtReward);
  }

  addCollateral(addedCollateral: Decimalish): Trove {
    return new Trove({ ...this, collateral: this.collateral.add(addedCollateral) });
  }

  addDebt(addedDebt: Decimalish): Trove {
    return new Trove({ ...this, debt: this.debt.add(addedDebt) });
  }

  subtractCollateral(subtractedCollateral: Decimalish): Trove {
    return new Trove({ ...this, collateral: this.collateral.sub(subtractedCollateral) });
  }

  subtractDebt(subtractedDebt: Decimalish): Trove {
    return new Trove({ ...this, debt: this.debt.sub(subtractedDebt) });
  }
}

enum CDPStatus {
  nonExistent,
  active,
  closed
}

export class Liquity {
  public static useHint = true;

  protected price?: Decimal;

  private readonly cdpManager: CDPManager;
  private readonly priceFeed: IPriceFeed;
  private readonly sortedCDPs: ISortedCDPs;
  private readonly poolManager: IPoolManager;
  private readonly userAddress?: string;

  private constructor(
    cdpManager: CDPManager,
    priceFeed: IPriceFeed,
    sortedCDPs: ISortedCDPs,
    poolManager: IPoolManager,
    userAddress?: string
  ) {
    this.cdpManager = cdpManager;
    this.priceFeed = priceFeed;
    this.sortedCDPs = sortedCDPs;
    this.poolManager = poolManager;
    this.userAddress = userAddress;
  }

  static async connect(cdpManagerAddress: string, provider: Web3Provider, userAddress?: string) {
    const signerOrProvider = userAddress ? provider.getSigner(userAddress) : provider;
    const cdpManager = CDPManagerFactory.connect(cdpManagerAddress, signerOrProvider);

    const [priceFeed, sortedCDPs, poolManager] = await Promise.all([
      cdpManager.priceFeedAddress().then(address => {
        return IPriceFeedFactory.connect(address, signerOrProvider);
      }),
      cdpManager.sortedCDPsAddress().then(address => {
        return ISortedCDPsFactory.connect(address, signerOrProvider);
      }),
      cdpManager.poolManagerAddress().then(address => {
        return IPoolManagerFactory.connect(address, signerOrProvider);
      })
    ]);

    return new Liquity(cdpManager, priceFeed, sortedCDPs, poolManager, userAddress);
  }

  private requireAddress(): string {
    if (!this.userAddress) {
      throw Error("An address is required");
    }
    return this.userAddress;
  }

  private static computePendingReward(
    snapshotValue: Decimal,
    currentValue: Decimal,
    stake: Decimal
  ) {
    const rewardPerStake = currentValue.sub(snapshotValue);
    const reward = rewardPerStake.mul(stake);

    return reward;
  }

  async getTrove(address = this.requireAddress()): Promise<Trove | undefined> {
    const cdp = await this.cdpManager.CDPs(address);

    if (cdp.status !== CDPStatus.active) {
      return undefined;
    }

    const stake = new Decimal(cdp.stake);
    const snapshot = await this.cdpManager.rewardSnapshots(address);
    const snapshotETH = new Decimal(snapshot.ETH);
    const snapshotCLVDebt = new Decimal(snapshot.CLVDebt);
    const L_ETH = new Decimal(await this.cdpManager.L_ETH());
    const L_CLVDebt = new Decimal(await this.cdpManager.L_CLVDebt());

    const pendingCollateralReward = Liquity.computePendingReward(snapshotETH, L_ETH, stake);
    const pendingDebtReward = Liquity.computePendingReward(snapshotCLVDebt, L_CLVDebt, stake);

    return new Trove({
      collateral: new Decimal(cdp.coll),
      debt: new Decimal(cdp.debt),
      pendingCollateralReward,
      pendingDebtReward
    });
  }

  watchTrove(onTroveChanged: (trove: Trove | undefined) => void, address = this.requireAddress()) {
    const { CDPCreated, CDPUpdated, CDPClosed } = this.cdpManager.filters;

    const cdpCreated = CDPCreated(address, null);
    const cdpUpdated = CDPUpdated(address, null, null, null, null);
    const cdpClosed = CDPClosed(address);

    const cdpCreatedListener = () => {
      onTroveChanged(new Trove());
    };
    const cdpUpdatedListener = (_address: string, debt: BigNumber, collateral: BigNumber) => {
      // When a CDP is updated, pending rewards are applied to its collateral and debt, and then the
      // rewards are reset to 0. Therefore we don't need to calculate them here.
      onTroveChanged(new Trove({ collateral: new Decimal(collateral), debt: new Decimal(debt) }));
    };
    const cdpClosedListener = () => {
      onTroveChanged(undefined);
    };

    this.cdpManager.on(cdpCreated, cdpCreatedListener);
    this.cdpManager.on(cdpUpdated, cdpUpdatedListener);
    this.cdpManager.on(cdpClosed, cdpClosedListener);

    // TODO: we might want to setup a low-freq periodic task to check for any new rewards

    return () => {
      this.cdpManager.removeListener(cdpCreated, cdpCreatedListener);
      this.cdpManager.removeListener(cdpUpdated, cdpUpdatedListener);
      this.cdpManager.removeListener(cdpClosed, cdpClosedListener);
    };
  }

  private async findHint(trove: Trove, price: Decimalish, address: string) {
    if (!Liquity.useHint) {
      return address;
    }

    const numberOfTroves = (await this.getNumberOfTroves()).toNumber();

    if (!numberOfTroves) {
      return address;
    }

    const numberOfTrials = bigNumberify(Math.ceil(Math.sqrt(numberOfTroves))); // XXX not multiplying by 10 here
    const collateralRatio = trove.collateralRatioAfterRewardsAt(price).bigNumber;

    const approxHint = await this.cdpManager.getApproxHint(
      collateralRatio,
      bigNumberify(numberOfTrials)
    );

    const { 0: hint } = await this.sortedCDPs.findInsertPosition(
      collateralRatio,
      approxHint,
      approxHint
    );

    return hint;
  }

  async createTrove(trove: Trove, price: Decimalish) {
    const address = this.requireAddress();

    return this.cdpManager.openLoan(
      trove.debt.bigNumber,
      await this.findHint(trove, price, address),
      {
        value: trove.collateral.bigNumber
      }
    );
  }

  async depositEther(
    initialTrove: Trove,
    depositedEther: Decimalish,
    price: Decimalish,
    address = this.requireAddress()
  ) {
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return this.cdpManager.addColl(address, await this.findHint(finalTrove, price, address), {
      value: Decimal.from(depositedEther).bigNumber
    });
  }

  async withdrawEther(initialTrove: Trove, withdrawnEther: Decimalish, price: Decimalish) {
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return this.cdpManager.withdrawColl(
      Decimal.from(withdrawnEther).bigNumber,
      await this.findHint(finalTrove, price, address)
    );
  }

  async borrowQui(initialTrove: Trove, borrowedQui: Decimalish, price: Decimalish) {
    const address = this.requireAddress();
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return this.cdpManager.withdrawCLV(
      Decimal.from(borrowedQui).bigNumber,
      await this.findHint(finalTrove, price, address)
    );
  }

  async repayQui(initialTrove: Trove, repaidQui: Decimalish, price: Decimalish) {
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return this.cdpManager.repayCLV(
      Decimal.from(repaidQui).bigNumber,
      await this.findHint(finalTrove, price, address)
    );
  }

  getNumberOfTroves() {
    return this.cdpManager.getCDPOwnersCount();
  }

  async getPrice() {
    return new Decimal(await this.priceFeed.getPrice());
  }

  watchPrice(onPriceChanged: (price: Decimal) => void) {
    const { PriceUpdated } = this.priceFeed.filters;
    const priceUpdated = PriceUpdated(null);

    const priceUpdatedListener = (price: BigNumber) => {
      onPriceChanged(new Decimal(price));
    };

    this.priceFeed.on(priceUpdated, priceUpdatedListener);

    return () => {
      this.priceFeed.removeListener(priceUpdated, priceUpdatedListener);
    };
  }

  async setPrice(price: Decimalish) {
    return this.priceFeed.setPrice(Decimal.from(price).bigNumber);
  }

  async getPool() {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this.poolManager.getActiveColl(),
        this.poolManager.getActiveDebt(),
        this.poolManager.getLiquidatedColl(),
        this.poolManager.getClosedDebt()
      ].map(promise => promise.then(bigNumber => new Decimal(bigNumber)))
    );

    return new Pool({ activeCollateral, activeDebt, liquidatedCollateral, closedDebt });
  }

  async liquidate(maximumNumberOfCDPsToLiquidate: BigNumberish) {
    return this.cdpManager.liquidateCDPs(maximumNumberOfCDPsToLiquidate);
  }
}
