import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import {
  Provider,
  BlockTag,
  TransactionResponse,
  TransactionReceipt
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Event } from "@ethersproject/contracts";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRewards,
  TroveChange,
  StabilityDeposit,
  ReadableLiquity,
  ObservableLiquity,
  HintedTransactionOptionalParams,
  TroveChangeOptionalParams,
  StabilityDepositTransferOptionalParams,
  HintedLiquity,
  LiquityReceipt,
  LiquityTransaction,
  ParsedLiquidation,
  ParsedRedemption
} from "@liquity/lib-base";

import {
  CDPManager,
  BorrowerOperations,
  SortedCDPs,
  PriceFeed,
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

enum CDPManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  partiallyLiquidateInRecoveryMode,
  redeemCollateral
}

const debouncingDelayMs = 50;
// With 68 iterations redemption costs about ~10M gas, and each iteration accounts for ~144k more
export const redeemMaxIterations = 68;

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

const noDetails = () => undefined;

// To get the best entropy available, we'd do something like:
//
// const bigRandomNumber = () =>
//   BigNumber.from(
//     `0x${Array.from(crypto.getRandomValues(new Uint32Array(8)))
//       .map(u32 => u32.toString(16).padStart(8, "0"))
//       .join("")}`
//   );
//
// However, Window.crypto is browser-specific. Since we only use this for randomly picking Troves
// during the search for hints, Math.random() will do fine, too.
//
// This returns a random integer between 0 and Number.MAX_SAFE_INTEGER
const randomInteger = () => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

// Maximum number of trials to perform in a single getApproxHint() call. If the number of trials
// required to get a statistically "good" hint is larger than this, the search for the hint will
// be broken up into multiple getApproxHint() calls.
//
// This should be low enough to work with popular public Ethereum providers like Infura without
// triggering any fair use limits.
const maxNumberOfTrialsAtOnce = 2500;

function* generateTrials(totalNumberOfTrials: number) {
  assert(Number.isInteger(totalNumberOfTrials) && totalNumberOfTrials > 0);

  while (totalNumberOfTrials) {
    const numberOfTrials = Math.min(totalNumberOfTrials, maxNumberOfTrialsAtOnce);
    yield numberOfTrials;

    totalNumberOfTrials -= numberOfTrials;
  }
}

class ParsedEthersTransaction<T = unknown>
  implements LiquityTransaction<TransactionResponse, LiquityReceipt<TransactionReceipt, T>> {
  readonly rawTransaction: TransactionResponse;

  private readonly parse: (rawReceipt: TransactionReceipt) => T;
  private readonly provider: Provider;

  constructor(
    rawTransaction: TransactionResponse,
    parse: (rawReceipt: TransactionReceipt) => T,
    provider: Provider
  ) {
    this.rawTransaction = rawTransaction;
    this.parse = parse;
    this.provider = provider;
  }

  private receiptFrom(rawReceipt: TransactionReceipt | null): LiquityReceipt<TransactionReceipt, T> {
    return rawReceipt
      ? rawReceipt.status
        ? { status: "succeeded", rawReceipt, details: this.parse(rawReceipt) }
        : { status: "failed", rawReceipt }
      : { status: "pending" };
  }

  async getReceipt() {
    return this.receiptFrom(await this.provider.getTransactionReceipt(this.rawTransaction.hash));
  }

  async waitForReceipt() {
    return this.receiptFrom(await this.provider.waitForTransaction(this.rawTransaction.hash));
  }
}

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

export class EthersLiquity
  implements
    ReadableLiquity,
    ObservableLiquity,
    HintedLiquity<TransactionResponse, TransactionReceipt> {
  readonly userAddress?: string;

  private readonly cdpManager: CDPManager;
  private readonly borrowerOperations: BorrowerOperations;
  private readonly priceFeed: PriceFeed;
  private readonly sortedCDPs: SortedCDPs;
  private readonly clvToken: CLVToken;
  private readonly activePool: ActivePool;
  private readonly defaultPool: DefaultPool;
  private readonly stabilityPool: StabilityPool;
  private readonly multiCDPgetter: MultiCDPGetter;
  private readonly hintHelpers: HintHelpers;

  private readonly provider: Provider;

  constructor(contracts: LiquityContracts, userAddress?: string) {
    this.cdpManager = contracts.cdpManager;
    this.borrowerOperations = contracts.borrowerOperations;
    this.priceFeed = contracts.priceFeed;
    this.sortedCDPs = contracts.sortedCDPs;
    this.clvToken = contracts.clvToken;
    this.activePool = contracts.activePool;
    this.defaultPool = contracts.defaultPool;
    this.stabilityPool = contracts.stabilityPool;
    this.multiCDPgetter = contracts.multiCDPgetter;
    this.hintHelpers = contracts.hintHelpers;
    this.userAddress = userAddress;

    this.provider = contracts.cdpManager.provider;
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

    const totalNumberOfTrials = Math.ceil(10 * Math.sqrt(numberOfTroves));
    const [firstTrials, ...restOfTrials] = generateTrials(totalNumberOfTrials);

    const collectApproxHint = (
      {
        latestRandomSeed,
        results
      }: {
        latestRandomSeed: BigNumberish;
        results: { diff: BigNumber; hintAddress: string }[];
      },
      numberOfTrials: number
    ) =>
      this.hintHelpers
        .getApproxHint(collateralRatio.bigNumber, numberOfTrials, price.bigNumber, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    const [hint] = await this.sortedCDPs.findInsertPosition(
      collateralRatio.bigNumber,
      price.bigNumber,
      hintAddress,
      hintAddress
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

  private wrapSimpleTransaction(rawTransaction: TransactionResponse) {
    return new ParsedEthersTransaction(rawTransaction, noDetails, this.provider);
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

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.openLoan(
        trove.netDebt.bigNumber,
        await this._findHint(trove, optionalParams),
        { value: trove.collateral.bigNumber, ...overrides }
      )
    );
  }

  async closeTrove(overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(await this.borrowerOperations.closeLoan({ ...overrides }));
  }

  async depositEther(
    depositedEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(depositedEther);

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.addColl(
        await this._findHint(finalTrove, hintOptionalParams),
        {
          value: Decimal.from(depositedEther).bigNumber,
          ...overrides
        }
      )
    );
  }

  async withdrawEther(
    withdrawnEther: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractCollateral(withdrawnEther);

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.withdrawColl(
        Decimal.from(withdrawnEther).bigNumber,
        await this._findHint(finalTrove, hintOptionalParams),
        { ...overrides }
      )
    );
  }

  async borrowQui(
    borrowedQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addDebt(borrowedQui);

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.withdrawCLV(
        Decimal.from(borrowedQui).bigNumber,
        await this._findHint(finalTrove, hintOptionalParams),
        { ...overrides }
      )
    );
  }

  async repayQui(
    repaidQui: Decimalish,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.subtractDebt(repaidQui);

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.repayCLV(
        Decimal.from(repaidQui).bigNumber,
        await this._findHint(finalTrove, hintOptionalParams),
        { ...overrides }
      )
    );
  }

  async changeTrove(
    change: TroveChange,
    { trove, ...hintOptionalParams }: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.apply(change);

    return this.wrapSimpleTransaction(
      await this.borrowerOperations.adjustLoan(
        change.collateralDifference?.negative?.absoluteValue?.bigNumber || 0,
        change.debtDifference?.absoluteValue?.bigNumber || 0,
        change.debtDifference?.positive ? true : false,
        await this._findHint(finalTrove, hintOptionalParams),
        {
          ...overrides,
          value: change.collateralDifference?.positive?.absoluteValue?.bigNumber
        }
      )
    );
  }

  async getNumberOfTroves(overrides?: EthersCallOverrides) {
    return (await this.cdpManager.getCDPOwnersCount({ ...overrides })).toNumber();
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
    return this.wrapSimpleTransaction(
      await this.priceFeed.setPrice(Decimal.from(price).bigNumber, { ...overrides })
    );
  }

  async updatePrice(overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(await this.priceFeed.updatePrice_Testnet({ ...overrides }));
  }

  async getTotal(overrides?: EthersCallOverrides) {
    const [activeCollateral, activeDebt, liquidatedCollateral, closedDebt] = await Promise.all(
      [
        this.activePool.getETH({ ...overrides }),
        this.activePool.getCLVDebt({ ...overrides }),
        this.defaultPool.getETH({ ...overrides }),
        this.defaultPool.getCLVDebt({ ...overrides })
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

  parseLiquidation({ logs }: TransactionReceipt): ParsedLiquidation {
    const fullyLiquidated = this.cdpManager
      .extractEvents(logs, "CDPLiquidated")
      .map(({ args: { _user } }) => _user);

    const [partiallyLiquidated] = this.cdpManager
      .extractEvents(logs, "CDPUpdated")
      .filter(
        ({ args: { operation } }) =>
          operation === CDPManagerOperation.partiallyLiquidateInRecoveryMode
      )
      .map(({ args: { _user } }) => _user);

    const [totals] = this.cdpManager
      .extractEvents(logs, "Liquidation")
      .map(
        ({
          args: { _CLVGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
        }) => ({
          collateralGasCompensation: new Decimal(_collGasCompensation),
          tokenGasCompensation: new Decimal(_CLVGasCompensation),

          totalLiquidated: new Trove({
            collateral: new Decimal(_liquidatedColl),
            debt: new Decimal(_liquidatedDebt)
          })
        })
      );

    return {
      fullyLiquidated,
      partiallyLiquidated,
      ...totals
    };
  }

  async liquidate(address: string, overrides?: EthersTransactionOverrides) {
    return new ParsedEthersTransaction(
      await this.cdpManager.liquidate(address, { ...overrides }),
      receipt => this.parseLiquidation(receipt),
      this.provider
    );
  }

  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ) {
    return new ParsedEthersTransaction(
      await this.cdpManager.liquidateCDPs(maximumNumberOfTrovesToLiquidate, { ...overrides }),
      receipt => this.parseLiquidation(receipt),
      this.provider
    );
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
    const [depositStruct, depositAfterLoss, pendingCollateralGain] = await Promise.all([
      this.stabilityPool.deposits(address, { ...overrides }),
      this.stabilityPool.getCompoundedCLVDeposit(address, { ...overrides }).then(decimalify),
      this.stabilityPool.getDepositorETHGain(address, { ...overrides }).then(decimalify)
    ]);

    const deposit = decimalify(depositStruct.initialValue);

    return new StabilityDeposit({ deposit, depositAfterLoss, pendingCollateralGain });
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address = this.requireAddress()
  ) {
    const { UserDepositChanged } = this.stabilityPool.filters;
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

    this.stabilityPool.on(userDepositChanged, depositListener);
    this.activePool.on(etherSent, etherSentListener);

    return () => {
      this.stabilityPool.removeListener(userDepositChanged, depositListener);
      this.activePool.removeListener(etherSent, etherSentListener);
    };
  }

  async depositQuiInStabilityPool(
    depositedQui: Decimalish,
    frontEndTag = AddressZero,
    overrides?: EthersTransactionOverrides
  ) {
    return this.wrapSimpleTransaction(
      await this.stabilityPool.provideToSP(Decimal.from(depositedQui).bigNumber, frontEndTag, {
        ...overrides
      })
    );
  }

  async withdrawQuiFromStabilityPool(
    withdrawnQui: Decimalish,
    overrides?: EthersTransactionOverrides
  ) {
    return this.wrapSimpleTransaction(
      await this.stabilityPool.withdrawFromSP(Decimal.from(withdrawnQui).bigNumber, { ...overrides })
    );
  }

  async transferCollateralGainToTrove(
    { deposit, trove, ...hintOptionalParams }: StabilityDepositTransferOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const initialTrove = trove ?? (await this.getTrove());
    const finalTrove = initialTrove.addCollateral(
      (deposit ?? (await this.getStabilityDeposit())).pendingCollateralGain
    );

    return this.wrapSimpleTransaction(
      await this.stabilityPool.withdrawETHGainToTrove(
        await this._findHint(finalTrove, hintOptionalParams),
        { ...overrides }
      )
    );
  }

  async getQuiInStabilityPool(overrides?: EthersCallOverrides) {
    return new Decimal(await this.stabilityPool.getTotalCLVDeposits({ ...overrides }));
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

  async sendQui(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(
      await this.clvToken.transfer(toAddress, Decimal.from(amount).bigNumber, { ...overrides })
    );
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

    return new ParsedEthersTransaction(
      await this.cdpManager.redeemCollateral(
        exchangedQui.bigNumber,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR.bigNumber,
        redeemMaxIterations,
        {
          ...overrides
        }
      ),
      ({ logs }) =>
        this.cdpManager.extractEvents(logs, "Redemption").map(
          ({
            args: { _ETHSent, _ETHFee, _actualCLVAmount, _attemptedCLVAmount }
          }): ParsedRedemption => ({
            attemptedTokenAmount: new Decimal(_attemptedCLVAmount),
            actualTokenAmount: new Decimal(_actualCLVAmount),
            collateralReceived: new Decimal(_ETHSent),
            fee: new Decimal(_ETHFee)
          })
        )[0],
      this.provider
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
