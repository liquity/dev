import { Signer } from "@ethersproject/abstract-signer";
import { Event } from "@ethersproject/contracts";
import { BigNumberish, BigNumber } from "@ethersproject/bignumber";
import { Provider, BlockTag } from "@ethersproject/abstract-provider";
import { AddressZero } from "@ethersproject/constants";

import { Decimal, Decimalish, Difference } from "@liquity/decimal";

import {
  CDPManager,
  BorrowerOperations,
  SortedCDPs,
  PriceFeed,
  PoolManager,
  ActivePool,
  DefaultPool,
  StabilityPool,
  CLVToken,
  MultiCDPGetter,
  HintHelpers
} from "../types";
import { LiquityContracts, LiquityContractAddresses, connectToContracts } from "./contracts";

interface Trovish {
  readonly collateral?: Decimalish;
  readonly debt?: Decimalish;
  readonly virtualDebt?: Decimalish;
}

type TroveChange = {
  collateralDifference?: Difference;
  debtDifference?: Difference;
};

export class Trove {
  readonly collateral: Decimal;
  readonly debt: Decimal;

  /**
   * Imaginary debt that doesn't need to be repaid, but counts towards collateral ratio (lowers it).
   *
   * When performing arithmetic on Troves (addition or subtraction of 2 Troves, multiplication by a
   * scalar), the virtual debt of the Trove on the left side of the operation will be copied to the
   * resulting Trove.
   */
  readonly virtualDebt: Decimal;

  constructor({
    collateral = 0,
    debt = 0,
    virtualDebt = Liquity.DEFAULT_VIRTUAL_DEBT
  }: Trovish = {}) {
    this.collateral = Decimal.from(collateral);
    this.debt = Decimal.from(debt);
    this.virtualDebt = Decimal.from(virtualDebt);
  }

  get isEmpty() {
    return this.collateral.isZero && this.debt.isZero;
  }

  get compositeDebt() {
    return this.debt.nonZero?.add(this.virtualDebt) ?? this.debt;
  }

  collateralRatio(price: Decimalish): Decimal {
    return this.collateral.mulDiv(price, this.compositeDebt);
  }

  collateralRatioIsBelowMinimum(price: Decimalish) {
    return this.collateralRatio(price).lt(Liquity.MINIMUM_COLLATERAL_RATIO);
  }

  collateralRatioIsBelowCritical(price: Decimalish) {
    return this.collateralRatio(price).lt(Liquity.CRITICAL_COLLATERAL_RATIO);
  }

  toString() {
    return (
      `{ collateral: ${this.collateral}` +
      `, debt: ${this.debt}` +
      (this.collateral.nonZero && this.virtualDebt.nonZero
        ? `, virtualDebt: ${this.virtualDebt}`
        : "") +
      " }"
    );
  }

  equals(that: Trove) {
    return this.collateral.eq(that.collateral) && this.debt.eq(that.debt);
  }

  add({ collateral = 0, debt = 0 }: Trovish) {
    return new Trove({
      collateral: this.collateral.add(collateral),
      debt: this.debt.add(debt),
      virtualDebt: this.virtualDebt
    });
  }

  addCollateral(collateral: Decimalish) {
    return this.add({ collateral });
  }

  addDebt(debt: Decimalish) {
    return this.add({ debt });
  }

  subtract({ collateral = 0, debt = 0 }: Trovish) {
    return new Trove({
      collateral: this.collateral.sub(collateral),
      debt: this.debt.sub(debt),
      virtualDebt: this.virtualDebt
    });
  }

  subtractCollateral(collateral: Decimalish) {
    return this.subtract({ collateral });
  }

  subtractDebt(debt: Decimalish) {
    return this.subtract({ debt });
  }

  multiply(multiplier: Decimalish) {
    return new Trove({
      collateral: this.collateral.mul(multiplier),
      debt: this.debt.mul(multiplier),
      virtualDebt: this.virtualDebt
    });
  }

  setCollateral(collateral: Decimalish) {
    return new Trove({
      collateral,
      debt: this.debt,
      virtualDebt: this.virtualDebt
    });
  }

  setDebt(debt: Decimalish) {
    return new Trove({
      collateral: this.collateral,
      debt,
      virtualDebt: this.virtualDebt
    });
  }

  whatChanged({ collateral, debt }: Trove) {
    const change: TroveChange = {};

    if (!collateral.eq(this.collateral)) {
      change.collateralDifference = Difference.between(collateral, this.collateral);
    }

    if (!debt.eq(this.debt)) {
      change.debtDifference = Difference.between(debt, this.debt);
    }

    return change;
  }

  applyCollateralDifference(collateralDifference?: Difference) {
    if (collateralDifference?.positive) {
      return this.addCollateral(collateralDifference.absoluteValue!);
    } else if (collateralDifference?.negative) {
      if (collateralDifference.absoluteValue!.lt(this.collateral)) {
        return this.subtractCollateral(collateralDifference.absoluteValue!);
      } else {
        return this.setCollateral(0);
      }
    } else {
      return this;
    }
  }

  applyDebtDifference(debtDifference?: Difference) {
    if (debtDifference?.positive) {
      return this.addDebt(debtDifference.absoluteValue!);
    } else if (debtDifference?.negative) {
      if (debtDifference.absoluteValue!.lt(this.collateral)) {
        return this.subtractDebt(debtDifference.absoluteValue!);
      } else {
        return this.setDebt(0);
      }
    } else {
      return this;
    }
  }

  apply({ collateralDifference, debtDifference }: TroveChange) {
    return this.applyCollateralDifference(collateralDifference).applyDebtDifference(debtDifference);
  }
}

interface TrovishWithPendingRewards extends Trovish {
  readonly stake?: Decimalish;
  readonly snapshotOfTotalRedistributed?: Trovish;
}

export class TroveWithPendingRewards extends Trove {
  readonly stake: Decimal;
  readonly snapshotOfTotalRedistributed: Trove;

  constructor({
    collateral = 0,
    debt = 0,
    stake = 0,
    snapshotOfTotalRedistributed
  }: TrovishWithPendingRewards = {}) {
    super({ collateral, debt });

    this.stake = Decimal.from(stake);
    this.snapshotOfTotalRedistributed = new Trove({
      ...snapshotOfTotalRedistributed,
      virtualDebt: 0
    });
  }

  applyRewards(totalRedistributed: Trove) {
    return this.add(
      totalRedistributed.subtract(this.snapshotOfTotalRedistributed).multiply(this.stake)
    );
  }

  equals(that: TroveWithPendingRewards) {
    return (
      super.equals(that) &&
      this.stake.eq(that.stake) &&
      this.snapshotOfTotalRedistributed.equals(that.snapshotOfTotalRedistributed)
    );
  }
}

// yeah, sounds stupid...
interface StabilityDepositish {
  readonly deposit?: Decimalish;
  readonly depositAfterLoss?: Decimalish;
  readonly pendingCollateralGain?: Decimalish;
}

export class StabilityDeposit {
  readonly deposit: Decimal;
  readonly depositAfterLoss: Decimal;
  readonly pendingCollateralGain: Decimal;

  get isEmpty() {
    return this.deposit.isZero && this.depositAfterLoss.isZero && this.pendingCollateralGain.isZero;
  }

  constructor({
    deposit = 0,
    depositAfterLoss = deposit,
    pendingCollateralGain = 0
  }: StabilityDepositish) {
    this.deposit = Decimal.from(deposit);
    this.depositAfterLoss = Decimal.from(depositAfterLoss);
    this.pendingCollateralGain = Decimal.from(pendingCollateralGain);
  }

  toString() {
    return (
      "{\n" +
      `  deposit: ${this.deposit},\n` +
      `  depositAfterLoss: ${this.depositAfterLoss},\n` +
      `  pendingCollateralGain: ${this.pendingCollateralGain}\n` +
      "}"
    );
  }

  equals(that: StabilityDeposit) {
    return (
      this.deposit.eq(that.deposit) &&
      this.depositAfterLoss.eq(that.depositAfterLoss) &&
      this.pendingCollateralGain.eq(that.pendingCollateralGain)
    );
  }

  calculateDifference(that: StabilityDeposit) {
    if (!that.depositAfterLoss.eq(this.depositAfterLoss)) {
      return Difference.between(that.depositAfterLoss, this.depositAfterLoss);
    }
  }

  apply(difference?: Difference) {
    if (difference?.positive) {
      return new StabilityDeposit({ deposit: this.depositAfterLoss.add(difference.absoluteValue!) });
    } else if (difference?.negative) {
      return new StabilityDeposit({
        deposit: difference.absoluteValue!.lt(this.depositAfterLoss)
          ? this.depositAfterLoss.sub(difference.absoluteValue!)
          : 0
      });
    } else {
      return this;
    }
  }
}

enum CDPStatus {
  nonExistent,
  active,
  closed
}

export type LiquityTransactionOverrides = {
  nonce?: BigNumberish | Promise<BigNumberish>;
  gasLimit?: BigNumberish | Promise<BigNumberish>;
  gasPrice?: BigNumberish | Promise<BigNumberish>;
};

export type LiquityCallOverrides = {
  blockTag?: BlockTag | Promise<BlockTag>;
  from?: string | Promise<string>;
};

const debouncingDelayMs = 50;

const debounce = (listener: (latestBlock: number) => void) => {
  let timeoutId: any = undefined;
  let latestBlock: number = 0;

  return (...args: any[]) => {
    const event = args[args.length - 1] as Event;

    if (event.blockNumber !== undefined && event.blockNumber > latestBlock) {
      latestBlock = event.blockNumber;
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      listener(latestBlock);
      timeoutId = undefined;
    }, debouncingDelayMs);
  };
};

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);
const numberify = (bigNumber: BigNumber) => bigNumber.toNumber();

type HintedMethodOptionalParams = {
  price?: Decimal;
  numberOfTroves?: number;
};

type TroveChangeOptionalParams = HintedMethodOptionalParams & {
  trove?: Trove;
};

type StabilityDepositTransferOptionalParams = TroveChangeOptionalParams & {
  deposit?: StabilityDeposit;
};

export class Liquity {
  public static readonly CRITICAL_COLLATERAL_RATIO: Decimal = Decimal.from(1.5);
  public static readonly MINIMUM_COLLATERAL_RATIO: Decimal = Decimal.from(1.1);
  // public static readonly DEFAULT_VIRTUAL_DEBT: Decimal = Decimal.from(10);
  public static readonly DEFAULT_VIRTUAL_DEBT: Decimal = Decimal.from(0);
  public static readonly LARGE_TROVE_MIN_COLLATERAL: Decimal = Decimal.from(10);

  public static useHint = true;

  public readonly userAddress?: string;

  private readonly cdpManager: CDPManager;
  private readonly borrowerOperations: BorrowerOperations;
  private readonly priceFeed: PriceFeed;
  private readonly sortedCDPs: SortedCDPs;
  private readonly clvToken: CLVToken;
  private readonly poolManager: PoolManager;
  private readonly activePool: ActivePool;
  private readonly defaultPool: DefaultPool;
  private readonly stabilityPool: StabilityPool;
  private readonly multiCDPgetter: MultiCDPGetter;
  private readonly hintHelpers: HintHelpers;

  constructor(contracts: LiquityContracts, userAddress?: string) {
    this.cdpManager = contracts.cdpManager;
    this.borrowerOperations = contracts.borrowerOperations;
    this.priceFeed = contracts.priceFeed;
    this.sortedCDPs = contracts.sortedCDPs;
    this.clvToken = contracts.clvToken;
    this.poolManager = contracts.poolManager;
    this.activePool = contracts.activePool;
    this.defaultPool = contracts.defaultPool;
    this.stabilityPool = contracts.stabilityPool;
    this.multiCDPgetter = contracts.multiCDPgetter;
    this.hintHelpers = contracts.hintHelpers;
    this.userAddress = userAddress;
  }

  static async connect(addresses: LiquityContractAddresses, signerOrProvider: Signer | Provider) {
    const userAddress = Signer.isSigner(signerOrProvider)
      ? await signerOrProvider.getAddress()
      : undefined;

    const contracts = connectToContracts(addresses, signerOrProvider);

    return new Liquity(contracts, userAddress);
  }

  private requireAddress(): string {
    if (!this.userAddress) {
      throw Error("An address is required");
    }
    return this.userAddress;
  }

  async getTotalRedistributed(overrides?: LiquityCallOverrides) {
    const [collateral, debt] = await Promise.all([
      this.cdpManager.L_ETH({ ...overrides }).then(decimalify),
      this.cdpManager.L_CLVDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove({ collateral, debt, virtualDebt: 0 });
  }

  watchTotalRedistributed(onTotalRedistributedChanged: (totalRedistributed: Trove) => void) {
    const etherSent = this.activePool.filters.EtherSent();

    const redistributionListener = debounce((blockTag: number) => {
      this.getTotalRedistributed({ blockTag }).then(onTotalRedistributedChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === this.defaultPool.address) {
        redistributionListener(event);
      }
    };

    this.activePool.on(etherSent, etherSentListener);

    return () => {
      this.activePool.removeListener(etherSent, etherSentListener);
    };
  }

  async getTroveWithoutRewards(address = this.requireAddress(), overrides?: LiquityCallOverrides) {
    const [cdp, snapshot] = await Promise.all([
      this.cdpManager.CDPs(address, { ...overrides }),
      this.cdpManager.rewardSnapshots(address, { ...overrides })
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

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRewards) => void,
    address = this.requireAddress()
  ) {
    const { CDPCreated, CDPUpdated } = this.cdpManager.filters;
    const cdpEventFilters = [CDPCreated(address), CDPUpdated(address)];

    const troveListener = debounce((blockTag: number) => {
      this.getTroveWithoutRewards(address, { blockTag }).then(onTroveChanged);
    });

    cdpEventFilters.forEach(filter => this.cdpManager.on(filter, troveListener));

    return () => {
      cdpEventFilters.forEach(filter => this.cdpManager.removeListener(filter, troveListener));
    };
  }

  async getTrove(address = this.requireAddress(), overrides?: LiquityCallOverrides) {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRewards(totalRedistributed);
  }

  async _findHintForCollateralRatio(
    collateralRatio: Decimal,
    optionalParams: HintedMethodOptionalParams,
    fallbackAddress: string
  ) {
    if (!Liquity.useHint) {
      return fallbackAddress;
    }

    const [price, numberOfTroves] = await Promise.all([
      optionalParams.price ?? this.getPrice(),
      optionalParams.numberOfTroves ?? this.getNumberOfTroves()
    ]);

    if (!numberOfTroves || collateralRatio.infinite) {
      return AddressZero;
    }

    const numberOfTrials = BigNumber.from(Math.ceil(10 * Math.sqrt(numberOfTroves)));

    const approxHint = await this.hintHelpers.getApproxHint(
      collateralRatio.bigNumber,
      numberOfTrials
    );

    const { 0: hint } = await this.sortedCDPs.findInsertPosition(
      collateralRatio.bigNumber,
      price.bigNumber,
      approxHint,
      approxHint
    );

    return hint;
  }

  async _findHint(
    trove: Trove,
    { price, ...rest }: HintedMethodOptionalParams = {},
    address: string
  ) {
    if (trove instanceof TroveWithPendingRewards) {
      throw new Error("Rewards must be applied to this Trove");
    }

    price = price ?? (await this.getPrice());

    return this._findHintForCollateralRatio(
      trove.collateralRatio(price),
      { price, ...rest },
      address
    );
  }

  async openTrove(
    trove: Trove,
    optionalParams?: HintedMethodOptionalParams,
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();

    return this.borrowerOperations.openLoan(
      trove.debt.bigNumber,
      await this._findHint(trove, optionalParams, address),
      { value: trove.collateral.bigNumber, ...overrides }
    );
  }

  async closeTrove(overrides?: LiquityTransactionOverrides) {
    return this.borrowerOperations.closeLoan({ ...overrides });
  }

  async depositEther(
    depositedEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: LiquityTransactionOverrides,
    address = this.requireAddress()
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return this.borrowerOperations.addColl(
      address,
      await this._findHint(finalTrove, hintOptionalParams, address),
      {
        value: Decimal.from(depositedEther).bigNumber,
        ...overrides
      }
    );
  }

  async withdrawEther(
    withdrawnEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return this.borrowerOperations.withdrawColl(
      Decimal.from(withdrawnEther).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams, address),
      { ...overrides }
    );
  }

  async borrowQui(
    borrowedQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return this.borrowerOperations.withdrawCLV(
      Decimal.from(borrowedQui).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams, address),
      { ...overrides }
    );
  }

  async repayQui(
    repaidQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return this.borrowerOperations.repayCLV(
      Decimal.from(repaidQui).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams, address),
      { ...overrides }
    );
  }

  async changeTrove(
    change: TroveChange,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.apply(change);

    return this.borrowerOperations.adjustLoan(
      change.collateralDifference?.negative?.absoluteValue?.bigNumber || 0,
      change.debtDifference?.bigNumber || 0,
      await this._findHint(finalTrove, hintOptionalParams, address),
      {
        ...overrides,
        value: change.collateralDifference?.positive?.absoluteValue?.bigNumber
      }
    );
  }

  getNumberOfTroves(overrides?: LiquityCallOverrides) {
    return this.cdpManager.getCDPOwnersCount({ ...overrides }).then(numberify);
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void) {
    const { CDPUpdated } = this.cdpManager.filters;
    const cdpUpdated = CDPUpdated();

    const cdpUpdatedListener = debounce((blockTag: number) => {
      this.getNumberOfTroves({ blockTag }).then(onNumberOfTrovesChanged);
    });

    this.cdpManager.on(cdpUpdated, cdpUpdatedListener);

    return () => {
      this.cdpManager.removeListener(cdpUpdated, cdpUpdatedListener);
    };
  }

  async getPrice(overrides?: LiquityCallOverrides) {
    return new Decimal(await this.priceFeed.getPrice({ ...overrides }));
  }

  watchPrice(onPriceChanged: (price: Decimal) => void) {
    const { PriceUpdated } = this.priceFeed.filters;
    const priceUpdated = PriceUpdated();

    const priceUpdatedListener = debounce((blockTag: number) => {
      this.getPrice({ blockTag }).then(onPriceChanged);
    });

    this.priceFeed.on(priceUpdated, priceUpdatedListener);

    return () => {
      this.priceFeed.removeListener(priceUpdated, priceUpdatedListener);
    };
  }

  async setPrice(price: Decimalish, overrides?: LiquityTransactionOverrides) {
    return this.priceFeed.setPrice(Decimal.from(price).bigNumber, { ...overrides });
  }

  async updatePrice(overrides?: LiquityTransactionOverrides) {
    return this.priceFeed.updatePrice_Testnet({ ...overrides });
  }

  async getTotal(overrides?: LiquityCallOverrides) {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this.poolManager.getActiveColl({ ...overrides }),
        this.poolManager.getActiveDebt({ ...overrides }),
        this.poolManager.getLiquidatedColl({ ...overrides }),
        this.poolManager.getClosedDebt({ ...overrides })
      ].map(getBigNumber => getBigNumber.then(decimalify))
    );

    return new Trove({
      collateral: activeCollateral.add(liquidatedCollateral),
      debt: activeDebt.add(closedDebt),
      virtualDebt: 0
    });
  }

  watchTotal(onTotalChanged: (total: Trove) => void) {
    const { CDPUpdated } = this.cdpManager.filters;
    const cdpUpdated = CDPUpdated();

    const totalListener = debounce((blockTag: number) => {
      this.getTotal({ blockTag }).then(onTotalChanged);
    });

    this.cdpManager.on(cdpUpdated, totalListener);

    return () => {
      this.cdpManager.removeListener(cdpUpdated, totalListener);
    };
  }

  async liquidate(address: string, overrides?: LiquityTransactionOverrides) {
    return this.cdpManager.liquidate(address, { ...overrides });
  }

  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: LiquityTransactionOverrides
  ) {
    return this.cdpManager.liquidateCDPs(maximumNumberOfTrovesToLiquidate, { ...overrides });
  }

  async _estimateLiquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: LiquityTransactionOverrides
  ) {
    return this.cdpManager.estimateGas.liquidateCDPs(maximumNumberOfTrovesToLiquidate, {
      ...overrides
    });
  }

  async getStabilityDeposit(address = this.requireAddress(), overrides?: LiquityCallOverrides) {
    const [deposit, depositAfterLoss, pendingCollateralGain] = await Promise.all([
      this.poolManager.initialDeposits(address, { ...overrides }).then(decimalify),
      this.poolManager.getCompoundedCLVDeposit(address, { ...overrides }).then(decimalify),
      this.poolManager.getCurrentETHGain(address, { ...overrides }).then(decimalify)
    ]);

    return new StabilityDeposit({ deposit, depositAfterLoss, pendingCollateralGain });
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address = this.requireAddress()
  ) {
    const { UserDepositChanged } = this.poolManager.filters;
    const { EtherSent } = this.activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const etherSent = EtherSent();

    const depositListener = debounce((blockTag: number) => {
      this.getStabilityDeposit(address, { blockTag }).then(onStabilityDepositChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === this.stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    this.poolManager.on(userDepositChanged, depositListener);
    this.activePool.on(etherSent, etherSentListener);

    return () => {
      this.poolManager.removeListener(userDepositChanged, depositListener);
      this.activePool.removeListener(etherSent, etherSentListener);
    };
  }

  depositQuiInStabilityPool(depositedQui: Decimalish, overrides?: LiquityTransactionOverrides) {
    return this.poolManager.provideToSP(Decimal.from(depositedQui).bigNumber, { ...overrides });
  }

  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish, overrides?: LiquityTransactionOverrides) {
    return this.poolManager.withdrawFromSP(Decimal.from(withdrawnQui).bigNumber, { ...overrides });
  }

  async transferCollateralGainToTrove(
    { deposit, trove, ...hintOptionalParams }: StabilityDepositTransferOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(
      (deposit ?? (await this.getStabilityDeposit())).pendingCollateralGain
    );

    return this.poolManager.withdrawFromSPtoCDP(
      address,
      await this._findHint(finalTrove, hintOptionalParams, address),
      { ...overrides }
    );
  }

  async getQuiInStabilityPool(overrides?: LiquityCallOverrides) {
    return new Decimal(await this.poolManager.getStabilityPoolCLV({ ...overrides }));
  }

  watchQuiInStabilityPool(onQuiInStabilityPoolChanged: (quiInStabilityPool: Decimal) => void) {
    const { Transfer } = this.clvToken.filters;

    const transferQuiFromStabilityPool = Transfer(this.stabilityPool.address);
    const transferQuiToStabilityPool = Transfer(null, this.stabilityPool.address);

    const stabilityPoolQuiFilters = [transferQuiFromStabilityPool, transferQuiToStabilityPool];

    const stabilityPoolQuiListener = debounce((blockTag: number) => {
      this.getQuiInStabilityPool({ blockTag }).then(onQuiInStabilityPoolChanged);
    });

    stabilityPoolQuiFilters.forEach(filter => this.clvToken.on(filter, stabilityPoolQuiListener));

    return () =>
      stabilityPoolQuiFilters.forEach(filter =>
        this.clvToken.removeListener(filter, stabilityPoolQuiListener)
      );
  }

  async getQuiBalance(address = this.requireAddress(), overrides?: LiquityCallOverrides) {
    return new Decimal(await this.clvToken.balanceOf(address, { ...overrides }));
  }

  watchQuiBalance(onQuiBalanceChanged: (balance: Decimal) => void, address = this.requireAddress()) {
    const { Transfer } = this.clvToken.filters;
    const transferQuiFromUser = Transfer(address);
    const transferQuiToUser = Transfer(null, address);

    const quiTransferFilters = [transferQuiFromUser, transferQuiToUser];

    const quiTransferListener = debounce((blockTag: number) => {
      this.getQuiBalance(address, { blockTag }).then(onQuiBalanceChanged);
    });

    quiTransferFilters.forEach(filter => this.clvToken.on(filter, quiTransferListener));

    return () =>
      quiTransferFilters.forEach(filter =>
        this.clvToken.removeListener(filter, quiTransferListener)
      );
  }

  sendQui(toAddress: string, amount: Decimalish, overrides?: LiquityTransactionOverrides) {
    return this.clvToken.transfer(toAddress, Decimal.from(amount).bigNumber, { ...overrides });
  }

  async _findRedemptionHints(
    exchangedQui: Decimal,
    { price, ...rest }: HintedMethodOptionalParams = {}
  ): Promise<[string, string, Decimal]> {
    if (!Liquity.useHint) {
      return [AddressZero, AddressZero, Decimal.INFINITY];
    }

    price = price ?? (await this.getPrice());

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await this.hintHelpers.getRedemptionHints(exchangedQui.bigNumber, price.bigNumber);

    const collateralRatio = new Decimal(partialRedemptionHintICR);

    return [
      firstRedemptionHint,
      collateralRatio.nonZero
        ? await this._findHintForCollateralRatio(collateralRatio, { price, ...rest }, AddressZero)
        : AddressZero,
      collateralRatio
    ];
  }

  async redeemCollateral(
    exchangedQui: Decimalish,
    optionalParams: HintedMethodOptionalParams = {},
    overrides?: LiquityTransactionOverrides
  ) {
    exchangedQui = Decimal.from(exchangedQui);

    const [
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR
    ] = await this._findRedemptionHints(exchangedQui, optionalParams);

    return this.cdpManager.redeemCollateral(
      exchangedQui.bigNumber,
      firstRedemptionHint,
      partialRedemptionHint,
      partialRedemptionHintICR.bigNumber,
      {
        ...overrides
      }
    );
  }

  async getLastTroves(startIdx: number, numberOfTroves: number, overrides?: LiquityCallOverrides) {
    const cdps = await this.multiCDPgetter.getMultipleSortedCDPs(-(startIdx + 1), numberOfTroves, {
      ...overrides
    });

    return mapMultipleSortedCDPsToTroves(cdps);
  }

  async getFirstTroves(startIdx: number, numberOfTroves: number, overrides?: LiquityCallOverrides) {
    const cdps = await this.multiCDPgetter.getMultipleSortedCDPs(startIdx, numberOfTroves, {
      ...overrides
    });

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
