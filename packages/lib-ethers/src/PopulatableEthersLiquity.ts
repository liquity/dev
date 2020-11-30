import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Provider, TransactionResponse, TransactionReceipt } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { PopulatedTransaction } from "@ethersproject/contracts";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRewards,
  TroveChange,
  ReadableLiquity,
  HintedTransactionOptionalParams,
  TroveChangeOptionalParams,
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
  transactableFrom
} from "@liquity/lib-base";

import { LiquityContracts } from "./contracts";
import { EthersTransactionOverrides } from "./types";
import { EthersLiquityBase } from "./EthersLiquityBase";

enum TroveManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  partiallyLiquidateInRecoveryMode,
  redeemCollateral
}

// With 68 iterations redemption costs about ~10M gas, and each iteration accounts for ~144k more
export const redeemMaxIterations = 68;

const noDetails = () => {};

const compose = <T, U, V>(f: (_: U) => V, g: (_: T) => U) => (_: T) => f(g(_));

const id = <T>(t: T) => t;

// Takes ~6-7K to update lastFeeOperationTime. Let's be on the safe side.
const addGasForPotentialLastFeeOperationTimeUpdate = (gas: BigNumber) => gas.add(10000);

// An extra traversal can take ~12K.
const addGasForPotentialListTraversal = (gas: BigNumber) => gas.add(15000);

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

class SentEthersTransaction<T = unknown>
  implements SentLiquityTransaction<TransactionResponse, LiquityReceipt<TransactionReceipt, T>> {
  readonly rawSentTransaction: TransactionResponse;

  private readonly parse: (rawReceipt: TransactionReceipt) => T;
  private readonly provider: Provider;

  constructor(
    rawSentTransaction: TransactionResponse,
    parse: (rawReceipt: TransactionReceipt) => T,
    provider: Provider
  ) {
    this.rawSentTransaction = rawSentTransaction;
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
    return this.receiptFrom(await this.provider.getTransactionReceipt(this.rawSentTransaction.hash));
  }

  async waitForReceipt() {
    const receipt = this.receiptFrom(
      await this.provider.waitForTransaction(this.rawSentTransaction.hash)
    );

    assert(receipt.status !== "pending");
    return receipt;
  }
}

class PopulatedEthersTransaction<T = unknown>
  implements
    PopulatedLiquityTransaction<
      PopulatedTransaction,
      SentLiquityTransaction<TransactionResponse, LiquityReceipt<TransactionReceipt, T>>
    > {
  readonly rawPopulatedTransaction: PopulatedTransaction;

  private readonly parse: (rawReceipt: TransactionReceipt) => T;
  private readonly signer: Signer;

  constructor(
    rawPopulatedTransaction: PopulatedTransaction,
    parse: (rawReceipt: TransactionReceipt) => T,
    signer: Signer
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this.parse = parse;
    this.signer = signer;
  }

  async send() {
    if (!this.signer.provider) {
      throw new Error("Signer must have a Provider");
    }

    return new SentEthersTransaction(
      await this.signer.sendTransaction(this.rawPopulatedTransaction),
      this.parse,
      this.signer.provider
    );
  }
}

class PopulatableEthersLiquityBase extends EthersLiquityBase {
  protected readonly readableLiquity: ReadableLiquity;

  private readonly signer: Signer;

  constructor(contracts: LiquityContracts, readableLiquity: ReadableLiquity, signer: Signer) {
    super(contracts);

    this.readableLiquity = readableLiquity;
    this.signer = signer;
  }

  protected wrapSimpleTransaction(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction(rawPopulatedTransaction, noDetails, this.signer);
  }

  protected wrapLiquidation(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction(
      rawPopulatedTransaction,
      ({ logs }: TransactionReceipt): LiquidationDetails => {
        const fullyLiquidated = this.contracts.troveManager
          .extractEvents(logs, "CDPLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [partiallyLiquidated] = this.contracts.troveManager
          .extractEvents(logs, "CDPUpdated")
          .filter(
            ({ args: { _operation } }) =>
              _operation === TroveManagerOperation.partiallyLiquidateInRecoveryMode
          )
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = this.contracts.troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _LUSDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: new Decimal(_collGasCompensation),
              tokenGasCompensation: new Decimal(_LUSDGasCompensation),

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
      },
      this.signer
    );
  }

  protected wrapRedemption(rawPopulatedTransaction: PopulatedTransaction) {
    return new PopulatedEthersTransaction(
      rawPopulatedTransaction,
      ({ logs }) =>
        this.contracts.troveManager.extractEvents(logs, "Redemption").map(
          ({
            args: { _ETHSent, _ETHFee, _actualLUSDAmount, _attemptedLUSDAmount }
          }): RedemptionDetails => ({
            attemptedTokenAmount: new Decimal(_attemptedLUSDAmount),
            actualTokenAmount: new Decimal(_actualLUSDAmount),
            collateralReceived: new Decimal(_ETHSent),
            fee: new Decimal(_ETHFee)
          })
        )[0],
      this.signer
    );
  }

  private async findHintForCollateralRatio(
    collateralRatio: Decimal,
    optionalParams: HintedTransactionOptionalParams
  ) {
    const [price, numberOfTroves] = await Promise.all([
      optionalParams.price ?? this.readableLiquity.getPrice(),
      optionalParams.numberOfTroves ?? this.readableLiquity.getNumberOfTroves()
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
      this.contracts.hintHelpers
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

    // Picking the second address as hint results in better gas cost, especially when having to
    // traverse the list due to interference
    const [, hint] = await this.contracts.sortedTroves.findInsertPosition(
      collateralRatio.bigNumber,
      price.bigNumber,
      hintAddress,
      hintAddress
    );

    return hint;
  }

  protected async findHint(trove: Trove, { price, ...rest }: HintedTransactionOptionalParams = {}) {
    if (trove instanceof TroveWithPendingRewards) {
      throw new Error("Rewards must be applied to this Trove");
    }

    price = price ?? (await this.readableLiquity.getPrice());

    return this.findHintForCollateralRatio(trove.collateralRatio(price), { price, ...rest });
  }

  protected async findRedemptionHints(
    exchangedQui: Decimal,
    { price, ...rest }: HintedTransactionOptionalParams = {}
  ): Promise<[string, string, Decimal]> {
    price = price ?? (await this.readableLiquity.getPrice());

    const {
      firstRedemptionHint,
      partialRedemptionHintICR
    } = await this.contracts.hintHelpers.getRedemptionHints(exchangedQui.bigNumber, price.bigNumber);

    const collateralRatio = new Decimal(partialRedemptionHintICR);

    return [
      firstRedemptionHint,
      collateralRatio.nonZero
        ? await this.findHintForCollateralRatio(collateralRatio, { price, ...rest })
        : AddressZero,
      collateralRatio
    ];
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
      await this.contracts.borrowerOperations.estimateAndPopulate.openTrove(
        { value: trove.collateral.bigNumber, ...overrides },
        compose(addGasForPotentialLastFeeOperationTimeUpdate, addGasForPotentialListTraversal),
        trove.netDebt.bigNumber,
        await this.findHint(trove, optionalParams)
      )
    );
  }

  async closeTrove(overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(
      await this.contracts.borrowerOperations.estimateAndPopulate.closeTrove({ ...overrides }, id)
    );
  }

  async depositEther(
    depositedEther: Decimalish,
    optionalParams: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const trove = optionalParams.trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = trove.addCollateral(depositedEther);

    return this.changeTrove(trove.whatChanged(finalTrove), { trove, ...optionalParams }, overrides);
  }

  async withdrawEther(
    withdrawnEther: Decimalish,
    optionalParams: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const trove = optionalParams.trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = trove.subtractCollateral(withdrawnEther);

    return this.changeTrove(trove.whatChanged(finalTrove), { trove, ...optionalParams }, overrides);
  }

  async borrowQui(
    borrowedQui: Decimalish,
    optionalParams: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const trove = optionalParams.trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = trove.addDebt(borrowedQui);

    return this.changeTrove(trove.whatChanged(finalTrove), { trove, ...optionalParams }, overrides);
  }

  async repayQui(
    repaidQui: Decimalish,
    optionalParams: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const trove = optionalParams.trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = trove.subtractDebt(repaidQui);

    return this.changeTrove(trove.whatChanged(finalTrove), { trove, ...optionalParams }, overrides);
  }

  async changeTrove(
    change: TroveChange,
    optionalParams: TroveChangeOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const { trove, ...hintOptionalParams } = optionalParams;
    const initialTrove = trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = initialTrove.apply(change);
    const isDebtIncrease = !!change.debtDifference?.positive;

    return this.wrapSimpleTransaction(
      await this.contracts.borrowerOperations.estimateAndPopulate.adjustTrove(
        {
          ...overrides,
          value: change.collateralDifference?.positive?.absoluteValue?.bigNumber
        },
        compose(
          isDebtIncrease ? addGasForPotentialLastFeeOperationTimeUpdate : id,
          addGasForPotentialListTraversal
        ),
        change.collateralDifference?.negative?.absoluteValue?.bigNumber || 0,
        change.debtDifference?.absoluteValue?.bigNumber || 0,
        isDebtIncrease,
        await this.findHint(finalTrove, hintOptionalParams)
      )
    );
  }

  async setPrice(price: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(
      await this.contracts.priceFeed.estimateAndPopulate.setPrice(
        { ...overrides },
        id,
        Decimal.from(price).bigNumber
      )
    );
  }

  async updatePrice(overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(
      await this.contracts.priceFeed.estimateAndPopulate.updatePrice_Testnet({ ...overrides }, id)
    );
  }

  async liquidate(address: string, overrides?: EthersTransactionOverrides) {
    return this.wrapLiquidation(
      await this.contracts.troveManager.estimateAndPopulate.liquidate({ ...overrides }, id, address)
    );
  }

  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ) {
    return this.wrapLiquidation(
      await this.contracts.troveManager.estimateAndPopulate.liquidateTroves(
        { ...overrides },
        id,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  async depositQuiInStabilityPool(
    depositedQui: Decimalish,
    frontEndTag = AddressZero,
    overrides?: EthersTransactionOverrides
  ) {
    return this.wrapSimpleTransaction(
      await this.contracts.stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        id,
        Decimal.from(depositedQui).bigNumber,
        frontEndTag
      )
    );
  }

  async withdrawQuiFromStabilityPool(
    withdrawnQui: Decimalish,
    overrides?: EthersTransactionOverrides
  ) {
    return this.wrapSimpleTransaction(
      await this.contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        id,
        Decimal.from(withdrawnQui).bigNumber
      )
    );
  }

  async transferCollateralGainToTrove(
    optionalParams: CollateralGainTransferOptionalParams = {},
    overrides?: EthersTransactionOverrides
  ) {
    const { deposit, trove, ...hintOptionalParams } = optionalParams;
    const initialTrove = trove ?? (await this.readableLiquity.getTrove());
    const finalTrove = initialTrove.addCollateral(
      (deposit ?? (await this.readableLiquity.getStabilityDeposit())).pendingCollateralGain
    );

    return this.wrapSimpleTransaction(
      await this.contracts.stabilityPool.estimateAndPopulate.withdrawETHGainToTrove(
        { ...overrides },
        addGasForPotentialListTraversal,
        await this.findHint(finalTrove, hintOptionalParams)
      )
    );
  }

  async sendQui(toAddress: string, amount: Decimalish, overrides?: EthersTransactionOverrides) {
    return this.wrapSimpleTransaction(
      await this.contracts.lusdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
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
    ] = await this.findRedemptionHints(exchangedQui, optionalParams);

    return this.wrapRedemption(
      await this.contracts.troveManager.estimateAndPopulate.redeemCollateral(
        { ...overrides },
        addGasForPotentialLastFeeOperationTimeUpdate,
        exchangedQui.bigNumber,
        firstRedemptionHint,
        partialRedemptionHint,
        partialRedemptionHintICR.bigNumber,
        redeemMaxIterations
      )
    );
  }
}

export const SendableEthersLiquity = sendableFrom(PopulatableEthersLiquity);
export type SendableEthersLiquity = InstanceType<typeof SendableEthersLiquity>;

export const TransactableEthersLiquity = transactableFrom(SendableEthersLiquity);
export type TransactableEthersLiquity = InstanceType<typeof TransactableEthersLiquity>;
