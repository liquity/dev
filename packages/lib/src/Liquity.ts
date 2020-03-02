import { ContractTransaction } from "ethers";
import { Web3Provider } from "ethers/providers";
import { bigNumberify, BigNumber } from "ethers/utils";

import { Decimal, Decimalish } from "../utils/Decimal";
import { LiquityContractAddresses, LiquityContracts } from "./contracts";
import { connectToContracts } from "./contractConnector";

const MAX_UINT256 = new Decimal(
  bigNumberify(2)
    .pow(256)
    .sub(1)
);

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
  readonly pendingCollateralReward?: Decimalish;
  readonly pendingDebtReward?: Decimalish;
}

export class Trove {
  readonly collateral: Decimal;
  readonly debt: Decimal;
  readonly pendingCollateralReward: Decimal;
  readonly pendingDebtReward: Decimal;

  private static calculateCollateralRatio(collateral: Decimal, debt: Decimal, price: Decimal) {
    if (debt.isZero()) {
      return MAX_UINT256;
    }
    return collateral.mulDiv(price, debt);
  }

  get collateralRatio(): Decimal {
    return Trove.calculateCollateralRatio(this.collateral, this.debt, this.price);
  }

  get collateralRatioAfterRewards(): Decimal {
    const collateralAfterRewards = this.collateral.add(this.pendingCollateralReward);
    const debtAfterRewards = this.debt.add(this.pendingDebtReward);

    return Trove.calculateCollateralRatio(collateralAfterRewards, debtAfterRewards, this.price);
  }

  private static price: Decimal = Decimal.from(200);

  get price() {
    return Trove.price;
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

  private readonly contracts: LiquityContracts;
  private readonly userAddress?: string;

  private constructor(contracts: LiquityContracts, userAddress?: string) {
    this.contracts = contracts;
    this.userAddress = userAddress;
  }

  static connect(addresses: LiquityContractAddresses, provider: Web3Provider, userAddress?: string) {
    if (userAddress) {
      return new Liquity(
        connectToContracts(addresses, provider.getSigner(userAddress)),
        userAddress
      );
    } else {
      return new Liquity(connectToContracts(addresses, provider));
    }
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
    const { cdpManager } = this.contracts;

    const cdp = await cdpManager.CDPs(address);

    if (cdp.status !== CDPStatus.active) {
      return undefined;
    }

    const stake = new Decimal(cdp.stake);
    const snapshot = await cdpManager.rewardSnapshots(address);
    const snapshotETH = new Decimal(snapshot.ETH);
    const snapshotCLVDebt = new Decimal(snapshot.CLVDebt);
    const L_ETH = new Decimal(await cdpManager.L_ETH());
    const L_CLVDebt = new Decimal(await cdpManager.L_CLVDebt());

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
    const { cdpManager } = this.contracts;
    const { CDPCreated, CDPUpdated, CDPClosed } = cdpManager.filters;

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

    cdpManager.on(cdpCreated, cdpCreatedListener);
    cdpManager.on(cdpUpdated, cdpUpdatedListener);
    cdpManager.on(cdpClosed, cdpClosedListener);

    // TODO: we might want to setup a low-freq periodic task to check for any new rewards

    return () => {
      cdpManager.removeListener(cdpCreated, cdpCreatedListener);
      cdpManager.removeListener(cdpUpdated, cdpUpdatedListener);
      cdpManager.removeListener(cdpClosed, cdpClosedListener);
    };
  }

  private async findHint(trove: Trove, address: string) {
    const { cdpManager, sortedCDPs } = this.contracts;

    if (!Liquity.useHint) {
      return address;
    }

    const numberOfTroves = (await this.getNumberOfTroves()).toNumber();

    if (!numberOfTroves) {
      return address;
    }

    const numberOfTrials = bigNumberify(Math.ceil(Math.sqrt(numberOfTroves))); // XXX not multiplying by 10 here
    const collateralRatio = trove.collateralRatioAfterRewards.bigNumber;
    const approxHint = await cdpManager.getApproxHint(collateralRatio, bigNumberify(numberOfTrials));
    const { 0: hint } = await sortedCDPs.findInsertPosition(collateralRatio, approxHint, approxHint);

    return hint;
  }

  async createTrove(trove: Trove) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();

    return cdpManager.openLoan(trove.debt.bigNumber, await this.findHint(trove, address), {
      value: trove.collateral.bigNumber
    });
  }

  async depositEther(
    initialTrove: Trove,
    depositedEther: Decimalish,
    address = this.requireAddress()
  ) {
    const { cdpManager } = this.contracts;
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return cdpManager.addColl(address, await this.findHint(finalTrove, address), {
      value: Decimal.from(depositedEther).bigNumber
    });
  }

  async withdrawEther(initialTrove: Trove, withdrawnEther: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return cdpManager.withdrawColl(
      Decimal.from(withdrawnEther).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }

  async borrowQui(initialTrove: Trove, borrowedQui: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return cdpManager.withdrawCLV(
      Decimal.from(borrowedQui).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }

  async repayQui(initialTrove: Trove, repaidQui: Decimalish) {
    const { cdpManager } = this.contracts;
    const address = this.requireAddress();
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return cdpManager.repayCLV(
      Decimal.from(repaidQui).bigNumber,
      await this.findHint(finalTrove, address)
    );
  }

  getNumberOfTroves() {
    return this.contracts.sortedCDPs.getSize();
  }
}
