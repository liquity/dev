import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import {
  Provider,
  TransactionResponse,
  TransactionReceipt,
  Log
} from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract, PopulatedTransaction } from "@ethersproject/contracts";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRewards,
  TroveAdjustment,
  ReadableLiquity,
  HintedMethodOptionalParams,
  TroveAdjustmentOptionalParams,
  CollateralGainTransferOptionalParams,
  Hinted,
  LiquityReceipt,
  SentLiquityTransaction,
  LiquidationDetails,
  RedemptionDetails,
  Populatable,
  TransactableLiquity,
  PopulatedLiquityTransaction,
  sendableFrom,
  transactableFrom,
  normalizeTroveAdjustment,
  TroveCreation,
  normalizeTroveCreation,
  TroveCreationOptionalParams,
  TroveChangeWithFees,
  TroveClosureDetails,
  CollateralGainTransferDetails,
  RedemptionOptionalParams,
  failedReceipt,
  pendingReceipt,
  successfulReceipt,
  StabilityPoolGainsWithdrawalDetails,
  StabilityDepositChangeDetails,
  MinedReceipt,
  TroveCreationDetails,
  TroveAdjustmentDetails,
  SendableFrom,
  TransactableFrom
} from "@liquity/lib-base";

import { LiquityContracts, priceFeedIsTestnet } from "./contracts";
import { EthersTransactionOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";
import { logsToString } from "./parseLogs";

// With 68 iterations redemption costs about ~10M gas, and each iteration accounts for ~144k more
export const redeemMaxIterations = 68;

const noDetails = () => undefined;

const compose = <T, U, V>(f: (_: U) => V, g: (_: T) => U) => (_: T) => f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K to update lastFeeOperationTime. Let's be on the safe side.
const addGasForPotentialLastFeeOperationTimeUpdate = (gas: BigNumber) => gas.add(10000);

// An extra traversal can take ~12K.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(25000);

const addGasForLQTYIssuance = (gas: BigNumber) => gas.add(40000);

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

export class SentEthersTransaction<T = unknown>
  implements SentLiquityTransaction<TransactionResponse, LiquityReceipt<TransactionReceipt, T>> {
  readonly rawSentTransaction: TransactionResponse;

  private readonly parse: (rawReceipt: TransactionReceipt) => T;
  private readonly provider: Provider;
  private readonly contracts: LiquityContracts;

  constructor(
    rawSentTransaction: TransactionResponse,
    parse: (rawReceipt: TransactionReceipt) => T,
    provider: Provider,
    contracts: LiquityContracts
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this.parse = parse;
    this.provider = provider;
    this.contracts = contracts;
  }

  private receiptFrom(rawReceipt: TransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? successfulReceipt(rawReceipt, this.parse(rawReceipt), () =>
            logsToString(rawReceipt, (this.contracts as unknown) as Record<string, Contract>)
          )
        : failedReceipt(rawReceipt)
      : pendingReceipt;
  }

  async getReceipt(): Promise<LiquityReceipt<TransactionReceipt, T>> {
    return this.receiptFrom(await this.provider.getTransactionReceipt(this.rawSentTransaction.hash));
  }

  async waitForReceipt(): Promise<MinedReceipt<TransactionReceipt, T>> {
    const receipt = this.receiptFrom(
      await this.provider.waitForTransaction(this.rawSentTransaction.hash)
    );

    assert(receipt.status !== "pending");
    return receipt;
  }
}

export class PopulatedEthersTransaction<T = unknown>
  implements PopulatedLiquityTransaction<PopulatedTransaction, SentEthersTransaction<T>> {
  readonly rawPopulatedTransaction: PopulatedTransaction;

  private readonly parse: (rawReceipt: TransactionReceipt) => T;
  private readonly signer: Signer;
  private readonly contracts: LiquityContracts;

  constructor(
    rawPopulatedTransaction: PopulatedTransaction,
    parse: (rawReceipt: TransactionReceipt) => T,
    signer: Signer,
    contracts: LiquityContracts
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this.parse = parse;
    this.signer = signer;
    this.contracts = contracts;
  }

  async send(): Promise<SentEthersTransaction<T>> {
    if (!this.signer.provider) {
      throw new Error("Signer must have a Provider");
    }

    return new SentEthersTransaction(
      await this.signer.sendTransaction(this.rawPopulatedTransaction),
      this.parse,
      this.signer.provider,
      this.contracts
    );
  }
}

class PopulatableEthersLiquityBase extends EthersLiquityBase {
  protected readonly readableLiquity: ReadableLiquity;
  protected readonly signer: Signer;

  constructor(contracts: LiquityContracts, readableLiquity: ReadableLiquity, signer: Signer) {
    super(contracts);

    this.readableLiquity = readableLiquity;
    this.signer = signer;
  }

  protected wrapSimpleTransaction(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction(
      rawPopulatedTransaction,
      noDetails,
      this.signer,
      this.contracts
    );
  }

  protected wrapTroveChangeWithFees<T>(params: T, rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<TroveChangeWithFees<T>>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this.contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(
            ({ args: { _coll, _debt } }) =>
              new Trove({ collateral: new Decimal(_coll), debt: new Decimal(_debt) })
          );

        const [fee] = this.contracts.borrowerOperations
          .extractEvents(logs, "LUSDBorrowingFeePaid")
          .map(({ args: { _LUSDFee } }) => new Decimal(_LUSDFee));

        return {
          params,
          newTrove,
          fee
        };
      },

      this.signer,
      this.contracts
    );
  }

  protected async wrapTroveClosure(rawPopulatedTransaction: PopulatedTransaction) {
    const userAddress = await this.signer.getAddress();

    return new PopulatedEthersTransaction<TroveClosureDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [repayLUSD] = this.contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => new Decimal(value));

        const [withdrawCollateral] = this.contracts.activePool
          .extractEvents(logs, "EtherSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => new Decimal(_amount));

        return {
          params: repayLUSD.nonZero ? { withdrawCollateral, repayLUSD } : { withdrawCollateral }
        };
      },

      this.signer,
      this.contracts
    );
  }

  protected wrapLiquidation(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<LiquidationDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const liquidatedAddresses = this.contracts.troveManager
          .extractEvents(logs, "TroveLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = this.contracts.troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _LUSDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: new Decimal(_collGasCompensation),
              lusdGasCompensation: new Decimal(_LUSDGasCompensation),

              totalLiquidated: new Trove({
                collateral: new Decimal(_liquidatedColl),
                debt: new Decimal(_liquidatedDebt)
              })
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      },

      this.signer,
      this.contracts
    );
  }

  protected wrapRedemption(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<RedemptionDetails>(
      rawPopulatedTransaction,

      ({ logs }) =>
        this.contracts.troveManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _ETHSent, _ETHFee, _actualLUSDAmount, _attemptedLUSDAmount } }) => ({
            attemptedLUSDAmount: new Decimal(_attemptedLUSDAmount),
            actualLUSDAmount: new Decimal(_actualLUSDAmount),
            collateralReceived: new Decimal(_ETHSent),
            fee: new Decimal(_ETHFee)
          }))[0],

      this.signer,
      this.contracts
    );
  }

  private extractStabilityPoolGainsWithdrawalDetails(
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    const [newLUSDDeposit] = this.contracts.stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => new Decimal(_newDeposit));

    const [[collateralGain, lusdLoss]] = this.contracts.stabilityPool
      .extractEvents(logs, "ETHGainWithdrawn")
      .map(({ args: { _ETH, _LUSDLoss } }) => [new Decimal(_ETH), new Decimal(_LUSDLoss)]);

    const [lqtyReward] = this.contracts.stabilityPool
      .extractEvents(logs, "LQTYPaidToDepositor")
      .map(({ args: { _LQTY } }) => new Decimal(_LQTY));

    return {
      lusdLoss,
      newLUSDDeposit,
      collateralGain,
      lqtyReward
    };
  }

  protected wrapStabilityPoolGainsWithdrawal(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<StabilityPoolGainsWithdrawalDetails>(
      rawPopulatedTransaction,
      ({ logs }) => this.extractStabilityPoolGainsWithdrawalDetails(logs),
      this.signer,
      this.contracts
    );
  }

  protected wrapStabilityDepositTopup(
    change: { depositLUSD: Decimal },
    rawPopulatedTransaction: PopulatedTransaction
  ) {
    return new PopulatedEthersTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => ({
        ...this.extractStabilityPoolGainsWithdrawalDetails(logs),
        change
      }),

      this.signer,
      this.contracts
    );
  }

  protected async wrapStabilityDepositWithdrawal(rawPopulatedTransaction: PopulatedTransaction) {
    const userAddress = await this.signer.getAddress();

    return new PopulatedEthersTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const gainsWithdrawalDetails = this.extractStabilityPoolGainsWithdrawalDetails(logs);

        const [withdrawLUSD] = this.contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(
            ({ args: { from, to } }) =>
              from === this.contracts.stabilityPool.address && to === userAddress
          )
          .map(({ args: { value } }) => new Decimal(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawLUSD, withdrawAllLUSD: gainsWithdrawalDetails.newLUSDDeposit.isZero }
        };
      },

      this.signer,
      this.contracts
    );
  }

  protected wrapCollateralGainTransfer(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction<CollateralGainTransferDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this.contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(
            ({ args: { _coll, _debt } }) =>
              new Trove({ collateral: new Decimal(_coll), debt: new Decimal(_debt) })
          );

        return {
          ...this.extractStabilityPoolGainsWithdrawalDetails(logs),
          newTrove
        };
      },

      this.signer,
      this.contracts
    );
  }

  private async findHintForNominalCollateralRatio(
    nominalCollateralRatio: Decimal,
    optionalParams: HintedMethodOptionalParams
  ): Promise<[string, string]> {
    const numberOfTroves =
      optionalParams.numberOfTroves ?? (await this.readableLiquity.getNumberOfTroves());

    if (!numberOfTroves) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await this.contracts.sortedTroves.getFirst()];
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
      this.contracts.hintHelpers
        .getApproxHint(nominalCollateralRatio.bigNumber, numberOfTrials, latestRandomSeed)
        .then(({ latestRandomSeed, ...result }) => ({
          latestRandomSeed,
          results: [...results, result]
        }));

    const { results } = await restOfTrials.reduce(
      (p, numberOfTrials) => p.then(state => collectApproxHint(state, numberOfTrials)),
      collectApproxHint({ latestRandomSeed: randomInteger(), results: [] }, firstTrials)
    );

    const { hintAddress } = results.reduce((a, b) => (a.diff.lt(b.diff) ? a : b));

    return this.contracts.sortedTroves.findInsertPosition(
      nominalCollateralRatio.bigNumber,
      hintAddress,
      hintAddress
    );
  }

  protected async findHint(trove: Trove, optionalParams: HintedMethodOptionalParams = {}) {
    if (trove instanceof TroveWithPendingRewards) {
      throw new Error("Rewards must be applied to this Trove");
    }

    return this.findHintForNominalCollateralRatio(trove.nominalCollateralRatio, optionalParams);
  }

  protected async findRedemptionHints(
    amount: Decimal,
    { price, ...hintOptionalParams }: RedemptionOptionalParams = {}
  ): Promise<[string, string, string, Decimal]> {
    price ??= await this.readableLiquity.getPrice();

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await this.contracts.hintHelpers.getRedemptionHints(
      amount.bigNumber,
      price.bigNumber,
      redeemMaxIterations
    );

    const collateralRatio = new Decimal(partialRedemptionHintNICR);

    const [upperHint, lowerHint] = collateralRatio.nonZero
      ? await this.findHintForNominalCollateralRatio(collateralRatio, hintOptionalParams)
      : [AddressZero, AddressZero];

    return [firstRedemptionHint, upperHint, lowerHint, collateralRatio];
  }
}

export class PopulatableEthersLiquity
  extends PopulatableEthersLiquityBase
  implements
    Populatable<
      Hinted<TransactableLiquity>,
      TransactionReceipt,
      TransactionResponse,
      PopulatedTransaction
    > {
  async openTrove(
    params: TroveCreation<Decimalish>,
    optionalParams: TroveCreationOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveCreationDetails>> {
    const normalized = normalizeTroveCreation(params);
    const { depositCollateral, borrowLUSD } = normalized;

    const fees = borrowLUSD && (optionalParams.fees ?? (await this.readableLiquity.getFees()));
    const newTrove = Trove.create(normalized, fees?.borrowingFeeFactor());

    return this.wrapTroveChangeWithFees(
      normalized,
      await this.contracts.borrowerOperations.estimateAndPopulate.openTrove(
        { value: depositCollateral.bigNumber, ...overrides },
        compose(addGasForPotentialLastFeeOperationTimeUpdate, addGasForPotentialListTraversal),
        0,
        borrowLUSD?.bigNumber ?? 0,
        ...(await this.findHint(newTrove, optionalParams))
      )
    );
  }

  async closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveClosureDetails>> {
    return this.wrapTroveClosure(
      await this.contracts.borrowerOperations.estimateAndPopulate.closeTrove({ ...overrides }, id)
    );
  }

  depositCollateral(
    amount: Decimalish,
    optionalParams: TroveAdjustmentOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ depositCollateral: amount }, optionalParams, overrides);
  }

  withdrawCollateral(
    amount: Decimalish,
    optionalParams: TroveAdjustmentOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ withdrawCollateral: amount }, optionalParams, overrides);
  }

  borrowLUSD(
    amount: Decimalish,
    optionalParams: TroveAdjustmentOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ borrowLUSD: amount }, optionalParams, overrides);
  }

  repayLUSD(
    amount: Decimalish,
    optionalParams: TroveAdjustmentOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ repayLUSD: amount }, optionalParams, overrides);
  }

  async adjustTrove(
    params: TroveAdjustment<Decimalish>,
    optionalParams: TroveAdjustmentOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<TroveAdjustmentDetails>> {
    const normalized = normalizeTroveAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD } = normalized;

    const [trove, fees] = await Promise.all([
      optionalParams.trove ?? this.readableLiquity.getTrove(),
      borrowLUSD && (optionalParams.fees ?? this.readableLiquity.getFees())
    ]);

    const finalTrove = trove.adjust(normalized, fees?.borrowingFeeFactor());

    return this.wrapTroveChangeWithFees(
      normalized,
      await this.contracts.borrowerOperations.estimateAndPopulate.adjustTrove(
        { value: depositCollateral?.bigNumber, ...overrides },
        compose(
          borrowLUSD ? addGasForPotentialLastFeeOperationTimeUpdate : id,
          addGasForPotentialListTraversal
        ),
        0,
        withdrawCollateral?.bigNumber ?? 0,
        (borrowLUSD ?? repayLUSD)?.bigNumber ?? 0,
        !!borrowLUSD,
        ...(await this.findHint(finalTrove, optionalParams))
      )
    );
  }

  async claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.borrowerOperations.estimateAndPopulate.claimCollateral(
        { ...overrides },
        id
      )
    );
  }

  async setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    if (!priceFeedIsTestnet(this.contracts.priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Liquity");
    }

    return this.wrapSimpleTransaction(
      await this.contracts.priceFeed.estimateAndPopulate.setPrice(
        { ...overrides },
        id,
        Decimal.from(price).bigNumber
      )
    );
  }

  async liquidate(
    address: string,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<LiquidationDetails>> {
    return this.wrapLiquidation(
      await this.contracts.troveManager.estimateAndPopulate.liquidate(
        { ...overrides },
        addGasForLQTYIssuance,
        address
      )
    );
  }

  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<LiquidationDetails>> {
    return this.wrapLiquidation(
      await this.contracts.troveManager.estimateAndPopulate.liquidateTroves(
        { ...overrides },
        addGasForLQTYIssuance,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  async depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag = AddressZero,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityDepositChangeDetails>> {
    const depositLUSD = Decimal.from(amount);

    return this.wrapStabilityDepositTopup(
      { depositLUSD },
      await this.contracts.stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        addGasForLQTYIssuance,
        depositLUSD.bigNumber,
        frontendTag
      )
    );
  }

  async withdrawLUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityDepositChangeDetails>> {
    return this.wrapStabilityDepositWithdrawal(
      await this.contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.from(amount).bigNumber
      )
    );
  }

  async withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this.wrapStabilityPoolGainsWithdrawal(
      await this.contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.ZERO.bigNumber
      )
    );
  }

  async transferCollateralGainToTrove(
    optionalParams: CollateralGainTransferOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<CollateralGainTransferDetails>> {
    const { deposit, trove, ...hintOptionalParams } = optionalParams;
    const initialTrove = trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = initialTrove.addCollateral(
      (deposit ?? (await this.readableLiquity.getStabilityDeposit())).collateralGain
    );

    return this.wrapCollateralGainTransfer(
      await this.contracts.stabilityPool.estimateAndPopulate.withdrawETHGainToTrove(
        { ...overrides },
        compose(addGasForPotentialListTraversal, addGasForLQTYIssuance),
        ...(await this.findHint(finalTrove, hintOptionalParams))
      )
    );
  }

  async sendLUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.lusdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  async sendLQTY(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.lqtyToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  async redeemLUSD(
    amount: Decimalish,
    optionalParams: RedemptionOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<RedemptionDetails>> {
    amount = Decimal.from(amount);

    const [
      firstRedemptionHint,
      upperPartialRedemptionHint,
      lowerPartialRedemptionHint,
      partialRedemptionHintNICR
    ] = await this.findRedemptionHints(amount, optionalParams);

    return this.wrapRedemption(
      await this.contracts.troveManager.estimateAndPopulate.redeemCollateral(
        { ...overrides },
        addGasForPotentialLastFeeOperationTimeUpdate,
        amount.bigNumber,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR.bigNumber,
        redeemMaxIterations,
        0
      )
    );
  }

  async stakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.lqtyStaking.estimateAndPopulate.stake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  async unstakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.lqtyStaking.estimateAndPopulate.unstake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.unstakeLQTY(Decimal.ZERO, overrides);
  }

  async registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersTransaction<void>> {
    return this.wrapSimpleTransaction(
      await this.contracts.stabilityPool.estimateAndPopulate.registerFrontEnd(
        { ...overrides },
        id,
        Decimal.from(kickbackRate).bigNumber
      )
    );
  }
}

export type SendableEthersLiquity = SendableFrom<PopulatableEthersLiquity>;

export const SendableEthersLiquity: new (
  populatable: PopulatableEthersLiquity
) => SendableEthersLiquity = sendableFrom(PopulatableEthersLiquity);

export type TransactableEthersLiquity = TransactableFrom<SendableEthersLiquity>;

export const TransactableEthersLiquity: new (
  sendable: SendableEthersLiquity
) => TransactableEthersLiquity = transactableFrom(SendableEthersLiquity);
