import { Signer } from "ethers";
import { Provider } from "ethers/providers";
import { bigNumberify, hexStripZeros, BigNumber, BigNumberish } from "ethers/utils";

import { Decimal, Decimalish, Difference } from "../utils/Decimal";

import { CDPManager } from "../types/ethers/CDPManager";
import { CDPManagerFactory } from "../types/ethers/CDPManagerFactory";
import { SortedCDPs } from "../types/ethers/SortedCDPs";
import { SortedCDPsFactory } from "../types/ethers/SortedCDPsFactory";
import { PriceFeed } from "../types/ethers/PriceFeed";
import { PriceFeedFactory } from "../types/ethers/PriceFeedFactory";
import { PoolManager } from "../types/ethers/PoolManager";
import { PoolManagerFactory } from "../types/ethers/PoolManagerFactory";
import { CLVToken } from "../types/ethers/CLVToken";
import { CLVTokenFactory } from "../types/ethers/CLVTokenFactory";

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
    return this.totalCollateralRatioAt(price).lt(Liquity.CRITICAL_COLLATERAL_RATIO);
  }
}

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
  readonly pendingCollateralReward?: Decimalish;
  readonly pendingDebtReward?: Decimalish;
}

const calculateCollateralRatio = (collateral: Decimal, debt: Decimal, price: Decimalish) => {
  if (debt.isZero) {
    return Decimal.INFINITY;
  }
  return collateral.mulDiv(price, debt);
};

export class Trove {
  readonly collateral: Decimal;
  readonly debt: Decimal;
  readonly pendingCollateralReward: Decimal;
  readonly pendingDebtReward: Decimal;

  get collateralAfterReward() {
    return this.collateral.add(this.pendingCollateralReward);
  }

  get debtAfterReward() {
    return this.debt.add(this.pendingDebtReward);
  }

  collateralRatioAt(price: Decimalish): Decimal {
    return calculateCollateralRatio(this.collateral, this.debt, price);
  }

  collateralRatioAfterRewardsAt(price: Decimalish): Decimal {
    return calculateCollateralRatio(this.collateralAfterReward, this.debtAfterReward, price);
  }

  isBelowMinimumCollateralRatioAt(price: Decimalish) {
    return this.collateralRatioAfterRewardsAt(price).lt(Liquity.MINIMUM_COLLATERAL_RATIO);
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
    return new Trove({
      collateral: this.collateralAfterReward.add(addedCollateral),
      debt: this.debtAfterReward
    });
  }

  addDebt(addedDebt: Decimalish): Trove {
    return new Trove({
      collateral: this.collateralAfterReward,
      debt: this.debtAfterReward.add(addedDebt)
    });
  }

  subtractCollateral(subtractedCollateral: Decimalish): Trove {
    return new Trove({
      collateral: this.collateralAfterReward.sub(subtractedCollateral),
      debt: this.debtAfterReward
    });
  }

  subtractDebt(subtractedDebt: Decimalish): Trove {
    return new Trove({
      collateral: this.collateralAfterReward,
      debt: this.debtAfterReward.sub(subtractedDebt)
    });
  }

  setCollateral(collateral: Decimalish): Trove {
    return new Trove({
      collateral,
      debt: this.debtAfterReward
    });
  }

  setDebt(debt: Decimalish): Trove {
    return new Trove({
      collateral: this.collateralAfterReward,
      debt
    });
  }

  whatChanged(that: Trove): { property: "collateral" | "debt"; difference: Difference } | undefined {
    if (!that.collateralAfterReward.eq(this.collateralAfterReward)) {
      return {
        property: "collateral",
        difference: Difference.between(that.collateralAfterReward, this.collateralAfterReward)
      };
    }
    if (!that.debtAfterReward.eq(this.debtAfterReward)) {
      return {
        property: "debt",
        difference: Difference.between(that.debtAfterReward, this.debtAfterReward)
      };
    }
  }
}

// yeah, sounds stupid...
interface StabilityDepositish {
  readonly deposit?: Decimalish;
  readonly pendingCollateralGain?: Decimalish;
  readonly pendingDepositLoss?: Decimalish;
}

export class StabilityDeposit {
  readonly deposit: Decimal;
  readonly pendingCollateralGain: Decimal;
  readonly pendingDepositLoss: Decimal;

  get isEmpty() {
    return (
      this.deposit.isZero && this.pendingCollateralGain.isZero && this.pendingDepositLoss.isZero
    );
  }

  get depositAfterLoss() {
    return this.deposit.sub(this.pendingDepositLoss);
  }

  constructor({
    deposit = 0,
    pendingCollateralGain = 0,
    pendingDepositLoss = 0
  }: StabilityDepositish) {
    this.deposit = Decimal.from(deposit);
    this.pendingCollateralGain = Decimal.from(pendingCollateralGain);

    if (this.deposit.gt(pendingDepositLoss)) {
      this.pendingDepositLoss = Decimal.from(pendingDepositLoss);
    } else {
      this.pendingDepositLoss = this.deposit;
    }
  }

  calculateDifference(that: StabilityDeposit) {
    if (!that.depositAfterLoss.eq(this.depositAfterLoss)) {
      return Difference.between(that.depositAfterLoss, this.depositAfterLoss);
    }
  }
}

enum CDPStatus {
  nonExistent,
  active,
  closed
}

export class Liquity {
  public static readonly CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);
  public static readonly MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);

  public static useHint = true;

  public readonly userAddress?: string;

  private readonly cdpManager: CDPManager;
  private readonly priceFeed: PriceFeed;
  private readonly sortedCDPs: SortedCDPs;
  private readonly poolManager: PoolManager;
  private readonly clvToken: CLVToken;

  private constructor(
    cdpManager: CDPManager,
    priceFeed: PriceFeed,
    sortedCDPs: SortedCDPs,
    poolManager: PoolManager,
    clvToken: CLVToken,
    userAddress?: string
  ) {
    this.cdpManager = cdpManager;
    this.priceFeed = priceFeed;
    this.sortedCDPs = sortedCDPs;
    this.poolManager = poolManager;
    this.clvToken = clvToken;
    this.userAddress = userAddress;
  }

  static async connect(cdpManagerAddress: string, signerOrProvider: Signer | Provider) {
    const userAddress = Signer.isSigner(signerOrProvider)
      ? await signerOrProvider.getAddress()
      : undefined;

    const cdpManager = CDPManagerFactory.connect(cdpManagerAddress, signerOrProvider);

    const [priceFeed, sortedCDPs, clvToken, poolManager] = await Promise.all([
      cdpManager.priceFeedAddress().then(address => {
        return PriceFeedFactory.connect(address, signerOrProvider);
      }),
      cdpManager.sortedCDPsAddress().then(address => {
        return SortedCDPsFactory.connect(address, signerOrProvider);
      }),
      cdpManager.clvTokenAddress().then(address => {
        return CLVTokenFactory.connect(address, signerOrProvider);
      }),
      cdpManager.poolManagerAddress().then(address => {
        return PoolManagerFactory.connect(address, signerOrProvider);
      })
    ]);

    return new Liquity(cdpManager, priceFeed, sortedCDPs, poolManager, clvToken, userAddress);
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

    const snapshot = await this.cdpManager.rewardSnapshots(address);
    const snapshotETH = new Decimal(snapshot.ETH);
    const snapshotCLVDebt = new Decimal(snapshot.CLVDebt);

    const L_ETH = new Decimal(await this.cdpManager.L_ETH());
    const L_CLVDebt = new Decimal(await this.cdpManager.L_CLVDebt());

    const stake = new Decimal(cdp.stake);
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
      { value: trove.collateral.bigNumber }
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

  async liquidate(address: string) {
    return this.cdpManager.liquidate(address, address);
  }

  async liquidateMany(maximumNumberOfCDPsToLiquidate: BigNumberish) {
    return this.cdpManager.liquidateCDPs(maximumNumberOfCDPsToLiquidate);
  }

  async getStabilityDeposit(address = this.requireAddress()) {
    const deposit = new Decimal(await this.poolManager.deposit(address));

    const snapshot = await this.poolManager.snapshot(address);
    const snapshotETH = new Decimal(snapshot.ETH);
    const snapshotCLV = new Decimal(snapshot.CLV);

    const S_ETH = new Decimal(await this.poolManager.S_ETH());
    const S_CLV = new Decimal(await this.poolManager.S_CLV());

    const pendingCollateralGain = Liquity.computePendingReward(snapshotETH, S_ETH, deposit);
    const pendingDepositLoss = Liquity.computePendingReward(snapshotCLV, S_CLV, deposit);

    return new StabilityDeposit({ deposit, pendingCollateralGain, pendingDepositLoss });
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address = this.requireAddress()
  ) {
    const { UserDepositChanged } = this.poolManager.filters;
    const userDepositChanged = UserDepositChanged(address, null);

    const userDepositChangedListener = (_address: string, deposit: BigNumber) => {
      onStabilityDepositChanged(new StabilityDeposit({ deposit: new Decimal(deposit) }));
    };

    this.poolManager.on(userDepositChanged, userDepositChangedListener);

    return () => {
      this.poolManager.removeListener(userDepositChanged, userDepositChangedListener);
    };
  }

  depositQuiInStabilityPool(depositedQui: Decimalish) {
    return this.poolManager.provideToSP(Decimal.from(depositedQui).bigNumber);
  }

  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish) {
    return this.poolManager.withdrawFromSP(Decimal.from(withdrawnQui).bigNumber);
  }

  async transferCollateralGainToTrove(
    deposit: StabilityDeposit,
    initialTrove: Trove,
    price: Decimalish
  ) {
    const address = this.requireAddress();
    const finalTrove = initialTrove.addCollateral(deposit.pendingCollateralGain);

    return this.poolManager.withdrawFromSPtoCDP(
      address,
      await this.findHint(finalTrove, price, address)
    );
  }

  async getQuiInStabilityPool() {
    return new Decimal(await this.poolManager.getStabilityPoolCLV());
  }

  async getQuiBalance(address = this.requireAddress()) {
    return new Decimal(await this.clvToken.balanceOf(address));
  }

  watchQuiBalance(onQuiBalanceChanged: (balance: Decimal) => void, address = this.requireAddress()) {
    const { Transfer } = this.clvToken.filters;
    const transferFromUser = Transfer(address, null, null);
    const transferToUser = Transfer(null, address, null);

    const transferListener = () => {
      this.getQuiBalance(address).then(onQuiBalanceChanged);
    };

    this.clvToken.on(transferFromUser, transferListener);
    this.clvToken.on(transferToUser, transferListener);

    return () => {
      this.clvToken.removeListener(transferFromUser, transferListener);
      this.clvToken.removeListener(transferToUser, transferListener);
    };
  }

  // Try to find the Trove with the lowest collateral ratio that is still above the minimum ratio
  // (i.e. it won't be liquidated by a redemption).
  // If no Trove is above the MCR, then it will find the Trove with the highest collateral ratio.
  async findLastTroveAboveMinimumCollateralRatio() {
    const lastTroveAddress = await this.sortedCDPs.getLast();

    if (hexStripZeros(lastTroveAddress) === "0x0") {
      // No Troves yet
      return undefined;
    }

    const { 0: found } = await this.sortedCDPs.findInsertPosition(
      Liquity.MINIMUM_COLLATERAL_RATIO.bigNumber,
      lastTroveAddress,
      lastTroveAddress
    );

    return found;
  }

  getNextTrove(address: string) {
    return this.sortedCDPs.getNext(address);
  }

  async redeemCollateral(exchangedQui: Decimalish) {
    const foundAddress = await this.findLastTroveAboveMinimumCollateralRatio();

    if (!foundAddress) {
      // This should only happen if there are no Troves (yet), in which case: what QUI are you
      // trying to exchange?
      throw new Error("There are no Troves");
    }
  }
  async getLastTroves(numberOfTroves: number) {
    if (numberOfTroves < 1) {
      throw new Error("numberOfTroves must be at least 1");
    }

    const troves: Promise<[string, Trove | undefined]>[] = [];

    const getTroveWithAddress = (address: string): Promise<[string, Trove | undefined]> =>
      this.getTrove(address).then(trove => [address, trove]);

    let i = 0;
    let currentAddress = await this.sortedCDPs.getLast();

    while (hexStripZeros(currentAddress) !== "0x0") {
      troves.push(getTroveWithAddress(currentAddress));

      if (++i === numberOfTroves) {
        break;
      }

      currentAddress = await this.sortedCDPs.getPrev(currentAddress);
    }

    return Promise.all(troves);
  }
}
