import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, Event } from "@ethersproject/contracts";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Provider, BlockTag } from "@ethersproject/abstract-provider";
import { AddressZero } from "@ethersproject/constants";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRewards,
  TroveChange,
  StabilityDeposit,
  ReadableLiquity,
  HintedTransactionOptionalParams,
  TroveChangeOptionalParams,
  StabilityDepositTransferOptionalParams,
  HintedLiquity
} from "@liquity/lib-base";

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

enum CDPStatus {
  nonExistent,
  active,
  closed
}

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

type PromisesOf<T> = {
  [P in keyof T]: T[P] extends infer U | undefined ? U | Promise<U> : T[P] | Promise<T[P]>;
};

export type EthersCallOverrides = PromisesOf<{
  blockTag?: BlockTag;
  from?: string;
}>;

export type EthersTransactionOverrides = PromisesOf<{
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
}>;

export class EthersLiquity implements ReadableLiquity, HintedLiquity<ContractTransaction> {
  readonly userAddress?: string;

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

    return new EthersLiquity(contracts, userAddress);
  }

  private requireAddress(): string {
    if (!this.userAddress) {
      throw Error("An address is required");
    }
    return this.userAddress;
  }

  async getTotalRedistributed(overrides?: EthersCallOverrides) {
    const [collateral, debt] = await Promise.all([
      this.cdpManager.L_ETH({ ...overrides }).then(decimalify),
      this.cdpManager.L_CLVDebt({ ...overrides }).then(decimalify)
    ]);

    return new Trove({ collateral, debt });
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

  async getTroveWithoutRewards(address = this.requireAddress(), overrides?: EthersCallOverrides) {
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

  async getTrove(address = this.requireAddress(), overrides?: EthersCallOverrides) {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address, { ...overrides }),
      this.getTotalRedistributed({ ...overrides })
    ] as const);

    return trove.applyRewards(totalRedistributed);
  }

  async _findHintForCollateralRatio(
    collateralRatio: Decimal,
    optionalParams: HintedTransactionOptionalParams
  ) {
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

  async _findHint(trove: Trove, { price, ...rest }: HintedTransactionOptionalParams = {}) {
    if (trove instanceof TroveWithPendingRewards) {
      throw new Error("Rewards must be applied to this Trove");
    }

    price = price ?? (await this.getPrice());

    return this._findHintForCollateralRatio(trove.collateralRatio(price), { price, ...rest });
  }

  async openTrove(
    trove: Trove,
    optionalParams?: HintedTransactionOptionalParams,
    overrides?: EthersTransactionOverrides
  ) {
    if (trove.debt.lt(Trove.GAS_COMPENSATION_DEPOSIT)) {
      throw new Error(
        `Trove must have at least ${Trove.GAS_COMPENSATION_DEPOSIT} debt ` +
          "(used as gas compensation deposit)"
      );
    }

    return this.borrowerOperations.openLoan(
      trove.netDebt.bigNumber,
      await this._findHint(trove, optionalParams),
      { value: trove.collateral.bigNumber, ...overrides }
    );
  }

  async closeTrove(overrides?: EthersTransactionOverrides) {
    return this.borrowerOperations.closeLoan({ ...overrides });
  }

  async depositEther(
    depositedEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return this.borrowerOperations.addColl(
      address,
      await this._findHint(finalTrove, hintOptionalParams),
      {
        value: Decimal.from(depositedEther).bigNumber,
        ...overrides
      }
    );
  }

  async withdrawEther(
    withdrawnEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return this.borrowerOperations.withdrawColl(
      Decimal.from(withdrawnEther).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams),
      { ...overrides }
    );
  }

  async borrowQui(
    borrowedQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return this.borrowerOperations.withdrawCLV(
      Decimal.from(borrowedQui).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams),
      { ...overrides }
    );
  }

  async repayQui(
    repaidQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return this.borrowerOperations.repayCLV(
      Decimal.from(repaidQui).bigNumber,
      await this._findHint(finalTrove, hintOptionalParams),
      { ...overrides }
    );
  }

  async changeTrove(
    change: TroveChange,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.apply(change);

    return this.borrowerOperations.adjustLoan(
      change.collateralDifference?.negative?.absoluteValue?.bigNumber || 0,
      change.debtDifference?.bigNumber || 0,
      await this._findHint(finalTrove, hintOptionalParams),
      {
        ...overrides,
        value: change.collateralDifference?.positive?.absoluteValue?.bigNumber
      }
    );
  }

  getNumberOfTroves(overrides?: EthersCallOverrides) {
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

  async getPrice(overrides?: EthersCallOverrides) {
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

  async setPrice(price: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.priceFeed.setPrice(Decimal.from(price).bigNumber, { ...overrides });
  }

  async updatePrice(overrides?: EthersTransactionOverrides) {
    return this.priceFeed.updatePrice_Testnet({ ...overrides });
  }

  async getTotal(overrides?: EthersCallOverrides) {
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
      debt: activeDebt.add(closedDebt)
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

  async liquidate(address: string, overrides?: EthersTransactionOverrides) {
    return this.cdpManager.liquidate(address, { ...overrides });
  }

  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ) {
    return this.cdpManager.liquidateCDPs(maximumNumberOfTrovesToLiquidate, { ...overrides });
  }

  async _estimateLiquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ) {
    return this.cdpManager.estimateGas.liquidateCDPs(maximumNumberOfTrovesToLiquidate, {
      ...overrides
    });
  }

  async getStabilityDeposit(address = this.requireAddress(), overrides?: EthersCallOverrides) {
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

  depositQuiInStabilityPool(depositedQui: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.poolManager.provideToSP(Decimal.from(depositedQui).bigNumber, { ...overrides });
  }

  withdrawQuiFromStabilityPool(withdrawnQui: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.poolManager.withdrawFromSP(Decimal.from(withdrawnQui).bigNumber, { ...overrides });
  }

  async transferCollateralGainToTrove(
    { deposit, trove, ...hintOptionalParams }: StabilityDepositTransferOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const address = this.requireAddress();
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(
      (deposit ?? (await this.getStabilityDeposit())).pendingCollateralGain
    );

    return this.poolManager.withdrawFromSPtoCDP(
      address,
      await this._findHint(finalTrove, hintOptionalParams),
      { ...overrides }
    );
  }

  async getQuiInStabilityPool(overrides?: EthersCallOverrides) {
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

  async getQuiBalance(address = this.requireAddress(), overrides?: EthersCallOverrides) {
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

  sendQui(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.clvToken.transfer(toAddress, Decimal.from(amount).bigNumber, { ...overrides });
  }

  async _findRedemptionHints(
    exchangedQui: Decimal,
    { price, ...rest }: HintedTransactionOptionalParams = {}
  ): Promise<[string, string, Decimal]> {
    price = price ?? (await this.getPrice());

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await this.hintHelpers.getRedemptionHints(exchangedQui.bigNumber, price.bigNumber);

    const collateralRatio = new Decimal(partialRedemptionHintICR);

    return [
      firstRedemptionHint,
      collateralRatio.nonZero
        ? await this._findHintForCollateralRatio(collateralRatio, { price, ...rest })
        : AddressZero,
      collateralRatio
    ];
  }

  async redeemCollateral(
    exchangedQui: Decimalish,
    optionalParams: HintedTransactionOptionalParams = {},
    overrides?: EthersTransactionOverrides
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

  async getLastTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
    const cdps = await this.multiCDPgetter.getMultipleSortedCDPs(-(startIdx + 1), numberOfTroves, {
      ...overrides
    });

    return mapMultipleSortedCDPsToTroves(cdps);
  }

  async getFirstTroves(startIdx: number, numberOfTroves: number, overrides?: EthersCallOverrides) {
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
