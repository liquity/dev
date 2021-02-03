import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Provider, Log } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Contract } from "@ethersproject/contracts";

import { Decimal, Decimalish } from "@liquity/decimal";

import {
  Trove,
  TroveWithPendingRedistribution,
  TroveAdjustmentParams,
  ReadableLiquity,
  LiquityReceipt,
  SentLiquityTransaction,
  LiquidationDetails,
  RedemptionDetails,
  PopulatedLiquityTransaction,
  _normalizeTroveAdjustment,
  TroveCreationParams,
  _normalizeTroveCreation,
  TroveClosureDetails,
  CollateralGainTransferDetails,
  _failedReceipt,
  _pendingReceipt,
  _successfulReceipt,
  StabilityPoolGainsWithdrawalDetails,
  StabilityDepositChangeDetails,
  MinedReceipt,
  TroveCreationDetails,
  TroveAdjustmentDetails,
  _SendableFrom,
  _TransactableFrom,
  PopulatableLiquity,
  LiquityStore,
  TransactionFailedError,
  FailedReceipt
} from "@liquity/lib-base";

import {
  EthersTransactionOverrides,
  EthersPopulatedTransaction,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import { LiquityContracts, priceFeedIsTestnet } from "./contracts";
import { logsToString } from "./parseLogs";
import { _EthersLiquityBase } from "./EthersLiquityBase";

// With 68 iterations redemption costs about ~10M gas, and each iteration accounts for ~144k more
/** @internal */
export const _redeemMaxIterations = 68;

const slippageTolerance = Decimal.from(0.005); // 0.5%

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

/**
 * A transaction that has already been sent.
 *
 * @remarks
 * Returned by {@link SendableEthersLiquity} functions.
 *
 * @public
 */
export class SentEthersLiquityTransaction<T = unknown>
  implements
    SentLiquityTransaction<EthersTransactionResponse, LiquityReceipt<EthersTransactionReceipt, T>> {
  /** Ethers' representation of a sent transaction. */
  readonly rawSentTransaction: EthersTransactionResponse;

  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;
  private readonly _provider: Provider;
  private readonly _contracts: LiquityContracts;

  /** @internal */
  constructor(
    rawSentTransaction: EthersTransactionResponse,
    parse: (rawReceipt: EthersTransactionReceipt) => T,
    provider: Provider,
    contracts: LiquityContracts
  ) {
    this.rawSentTransaction = rawSentTransaction;
    this._parse = parse;
    this._provider = provider;
    this._contracts = contracts;
  }

  private _receiptFrom(rawReceipt: EthersTransactionReceipt | null) {
    return rawReceipt
      ? rawReceipt.status
        ? _successfulReceipt(rawReceipt, this._parse(rawReceipt), () =>
            logsToString(rawReceipt, (this._contracts as unknown) as Record<string, Contract>)
          )
        : _failedReceipt(rawReceipt)
      : _pendingReceipt;
  }

  /** {@inheritDoc @liquity/lib-base#SentLiquityTransaction.getReceipt} */
  async getReceipt(): Promise<LiquityReceipt<EthersTransactionReceipt, T>> {
    return this._receiptFrom(
      await this._provider.getTransactionReceipt(this.rawSentTransaction.hash)
    );
  }

  /** {@inheritDoc @liquity/lib-base#SentLiquityTransaction.waitForReceipt} */
  async waitForReceipt(): Promise<MinedReceipt<EthersTransactionReceipt, T>> {
    const receipt = this._receiptFrom(
      await this._provider.waitForTransaction(this.rawSentTransaction.hash)
    );

    assert(receipt.status !== "pending");
    return receipt;
  }
}

/**
 * A transaction that has been prepared for sending.
 *
 * @remarks
 * Returned by {@link PopulatableEthersLiquity} functions.
 *
 * @public
 */
export class PopulatedEthersLiquityTransaction<T = unknown>
  implements
    PopulatedLiquityTransaction<EthersPopulatedTransaction, SentEthersLiquityTransaction<T>> {
  /** Unsigned transaction object populated by Ethers. */
  readonly rawPopulatedTransaction: EthersPopulatedTransaction;

  private readonly _parse: (rawReceipt: EthersTransactionReceipt) => T;
  private readonly _signer: Signer;
  private readonly _contracts: LiquityContracts;

  /** @internal */
  constructor(
    rawPopulatedTransaction: EthersPopulatedTransaction,
    parse: (rawReceipt: EthersTransactionReceipt) => T,
    signer: Signer,
    contracts: LiquityContracts
  ) {
    this.rawPopulatedTransaction = rawPopulatedTransaction;
    this._parse = parse;
    this._signer = signer;
    this._contracts = contracts;
  }

  /** {@inheritDoc @liquity/lib-base#PopulatedLiquityTransaction.send} */
  async send(): Promise<SentEthersLiquityTransaction<T>> {
    if (!this._signer.provider) {
      throw new Error("Signer must have a Provider");
    }

    return new SentEthersLiquityTransaction(
      await this._signer.sendTransaction(this.rawPopulatedTransaction),
      this._parse,
      this._signer.provider,
      this._contracts
    );
  }
}

interface TroveChangeWithFees<T> {
  params: T;
  newTrove: Trove;
  fee: Decimal;
}

/** @internal */
class _PopulatableEthersLiquityBase extends _EthersLiquityBase {
  protected readonly _readableLiquity: ReadableLiquity;
  protected readonly _store?: LiquityStore;
  protected readonly _signer: Signer;

  constructor(
    contracts: LiquityContracts,
    readableLiquity: ReadableLiquity,
    signer: Signer,
    store?: LiquityStore
  ) {
    super(contracts);

    this._readableLiquity = readableLiquity;
    this._signer = signer;
    this._store = store;
  }

  protected _wrapSimpleTransaction(rawPopulatedTransaction: EthersPopulatedTransaction) {
    return new PopulatedEthersLiquityTransaction(
      rawPopulatedTransaction,
      noDetails,
      this._signer,
      this._contracts
    );
  }

  protected _wrapTroveChangeWithFees<T>(
    params: T,
    rawPopulatedTransaction: EthersPopulatedTransaction
  ) {
    return new PopulatedEthersLiquityTransaction<TroveChangeWithFees<T>>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this._contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(new Decimal(_coll), new Decimal(_debt)));

        const [fee] = this._contracts.borrowerOperations
          .extractEvents(logs, "LUSDBorrowingFeePaid")
          .map(({ args: { _LUSDFee } }) => new Decimal(_LUSDFee));

        return {
          params,
          newTrove,
          fee
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected async _wrapTroveClosure(rawPopulatedTransaction: EthersPopulatedTransaction) {
    const userAddress = await this._signer.getAddress();

    return new PopulatedEthersLiquityTransaction<TroveClosureDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [repayLUSD] = this._contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(({ args: { from, to } }) => from === userAddress && to === AddressZero)
          .map(({ args: { value } }) => new Decimal(value));

        const [withdrawCollateral] = this._contracts.activePool
          .extractEvents(logs, "EtherSent")
          .filter(({ args: { _to } }) => _to === userAddress)
          .map(({ args: { _amount } }) => new Decimal(_amount));

        return {
          params: repayLUSD.nonZero ? { withdrawCollateral, repayLUSD } : { withdrawCollateral }
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapLiquidation(rawPopulatedTransaction: EthersPopulatedTransaction) {
    return new PopulatedEthersLiquityTransaction<LiquidationDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const liquidatedAddresses = this._contracts.troveManager
          .extractEvents(logs, "TroveLiquidated")
          .map(({ args: { _borrower } }) => _borrower);

        const [totals] = this._contracts.troveManager
          .extractEvents(logs, "Liquidation")
          .map(
            ({
              args: { _LUSDGasCompensation, _collGasCompensation, _liquidatedColl, _liquidatedDebt }
            }) => ({
              collateralGasCompensation: new Decimal(_collGasCompensation),
              lusdGasCompensation: new Decimal(_LUSDGasCompensation),
              totalLiquidated: new Trove(new Decimal(_liquidatedColl), new Decimal(_liquidatedDebt))
            })
          );

        return {
          liquidatedAddresses,
          ...totals
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapRedemption(rawPopulatedTransaction: EthersPopulatedTransaction) {
    return new PopulatedEthersLiquityTransaction<RedemptionDetails>(
      rawPopulatedTransaction,

      ({ logs }) =>
        this._contracts.troveManager
          .extractEvents(logs, "Redemption")
          .map(({ args: { _ETHSent, _ETHFee, _actualLUSDAmount, _attemptedLUSDAmount } }) => ({
            attemptedLUSDAmount: new Decimal(_attemptedLUSDAmount),
            actualLUSDAmount: new Decimal(_actualLUSDAmount),
            collateralTaken: new Decimal(_ETHSent),
            fee: new Decimal(_ETHFee)
          }))[0],

      this._signer,
      this._contracts
    );
  }

  private _extractStabilityPoolGainsWithdrawalDetails(
    logs: Log[]
  ): StabilityPoolGainsWithdrawalDetails {
    const [newLUSDDeposit] = this._contracts.stabilityPool
      .extractEvents(logs, "UserDepositChanged")
      .map(({ args: { _newDeposit } }) => new Decimal(_newDeposit));

    const [[collateralGain, lusdLoss]] = this._contracts.stabilityPool
      .extractEvents(logs, "ETHGainWithdrawn")
      .map(({ args: { _ETH, _LUSDLoss } }) => [new Decimal(_ETH), new Decimal(_LUSDLoss)]);

    const [lqtyReward] = this._contracts.stabilityPool
      .extractEvents(logs, "LQTYPaidToDepositor")
      .map(({ args: { _LQTY } }) => new Decimal(_LQTY));

    return {
      lusdLoss,
      newLUSDDeposit,
      collateralGain,
      lqtyReward
    };
  }

  protected _wrapStabilityPoolGainsWithdrawal(rawPopulatedTransaction: EthersPopulatedTransaction) {
    return new PopulatedEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>(
      rawPopulatedTransaction,
      ({ logs }) => this._extractStabilityPoolGainsWithdrawalDetails(logs),
      this._signer,
      this._contracts
    );
  }

  protected _wrapStabilityDepositTopup(
    change: { depositLUSD: Decimal },
    rawPopulatedTransaction: EthersPopulatedTransaction
  ) {
    return new PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => ({
        ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
        change
      }),

      this._signer,
      this._contracts
    );
  }

  protected async _wrapStabilityDepositWithdrawal(
    rawPopulatedTransaction: EthersPopulatedTransaction
  ) {
    const userAddress = await this._signer.getAddress();

    return new PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const gainsWithdrawalDetails = this._extractStabilityPoolGainsWithdrawalDetails(logs);

        const [withdrawLUSD] = this._contracts.lusdToken
          .extractEvents(logs, "Transfer")
          .filter(
            ({ args: { from, to } }) =>
              from === this._contracts.stabilityPool.address && to === userAddress
          )
          .map(({ args: { value } }) => new Decimal(value));

        return {
          ...gainsWithdrawalDetails,
          change: { withdrawLUSD, withdrawAllLUSD: gainsWithdrawalDetails.newLUSDDeposit.isZero }
        };
      },

      this._signer,
      this._contracts
    );
  }

  protected _wrapCollateralGainTransfer(rawPopulatedTransaction: EthersPopulatedTransaction) {
    return new PopulatedEthersLiquityTransaction<CollateralGainTransferDetails>(
      rawPopulatedTransaction,

      ({ logs }) => {
        const [newTrove] = this._contracts.borrowerOperations
          .extractEvents(logs, "TroveUpdated")
          .map(({ args: { _coll, _debt } }) => new Trove(new Decimal(_coll), new Decimal(_debt)));

        return {
          ...this._extractStabilityPoolGainsWithdrawalDetails(logs),
          newTrove
        };
      },

      this._signer,
      this._contracts
    );
  }

  private async _findHintsForNominalCollateralRatio(
    nominalCollateralRatio: Decimal
  ): Promise<[string, string]> {
    const numberOfTroves =
      this._store?.state.numberOfTroves ?? (await this._readableLiquity.getNumberOfTroves());

    if (!numberOfTroves) {
      return [AddressZero, AddressZero];
    }

    if (nominalCollateralRatio.infinite) {
      return [AddressZero, await this._contracts.sortedTroves.getFirst()];
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
      this._contracts.hintHelpers
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

    return this._contracts.sortedTroves.findInsertPosition(
      nominalCollateralRatio.bigNumber,
      hintAddress,
      hintAddress
    );
  }

  protected async _findHints(trove: Trove) {
    if (trove instanceof TroveWithPendingRedistribution) {
      throw new Error("Rewards must be applied to this Trove");
    }

    return this._findHintsForNominalCollateralRatio(trove._nominalCollateralRatio);
  }

  protected async _findRedemptionHints(amount: Decimal): Promise<[string, string, string, Decimal]> {
    const price = this._store?.state.price ?? (await this._readableLiquity.getPrice());

    const {
      firstRedemptionHint,
      partialRedemptionHintNICR
    } = await this._contracts.hintHelpers.getRedemptionHints(
      amount.bigNumber,
      price.bigNumber,
      _redeemMaxIterations
    );

    const collateralRatio = new Decimal(partialRedemptionHintNICR);

    const [upperHint, lowerHint] = collateralRatio.nonZero
      ? await this._findHintsForNominalCollateralRatio(collateralRatio)
      : [AddressZero, AddressZero];

    return [firstRedemptionHint, upperHint, lowerHint, collateralRatio];
  }
}

/**
 * Ethers-based implementation of {@link @liquity/lib-base#PopulatableLiquity}.
 *
 * @public
 */
export class PopulatableEthersLiquity
  extends _PopulatableEthersLiquityBase
  implements
    PopulatableLiquity<
      EthersTransactionReceipt,
      EthersTransactionResponse,
      EthersPopulatedTransaction
    > {
  constructor(
    contracts: LiquityContracts,
    readableLiquity: ReadableLiquity,
    signer: Signer,
    store?: LiquityStore
  ) {
    super(contracts, readableLiquity, signer, store);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveCreationDetails>> {
    const normalized = _normalizeTroveCreation(params);
    const { depositCollateral, borrowLUSD } = normalized;

    const fees = borrowLUSD && (this._store?.state.fees ?? (await this._readableLiquity.getFees()));
    const borrowingRate = fees?.borrowingRate();
    const newTrove = Trove.create(normalized, borrowingRate);
    const maxBorrowingRate = borrowingRate?.add(slippageTolerance);

    return this._wrapTroveChangeWithFees(
      normalized,
      await this._contracts.borrowerOperations.estimateAndPopulate.openTrove(
        { value: depositCollateral.bigNumber, ...overrides },
        compose(addGasForPotentialLastFeeOperationTimeUpdate, addGasForPotentialListTraversal),
        maxBorrowingRate?.bigNumber ?? 0,
        borrowLUSD?.bigNumber ?? 0,
        ...(await this._findHints(newTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.closeTrove} */
  async closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveClosureDetails>> {
    return this._wrapTroveClosure(
      await this._contracts.borrowerOperations.estimateAndPopulate.closeTrove({ ...overrides }, id)
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ depositCollateral: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ withdrawCollateral: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.borrowLUSD} */
  borrowLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ borrowLUSD: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.repayLUSD} */
  repayLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this.adjustTrove({ repayLUSD: amount }, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.adjustTrove} */
  async adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<TroveAdjustmentDetails>> {
    const normalized = _normalizeTroveAdjustment(params);
    const { depositCollateral, withdrawCollateral, borrowLUSD, repayLUSD } = normalized;

    const [trove, fees] = await Promise.all([
      this._store?.state.trove ?? this._readableLiquity.getTrove(),
      borrowLUSD && (this._store?.state.fees ?? this._readableLiquity.getFees())
    ]);

    const borrowingRate = fees?.borrowingRate();
    const finalTrove = trove.adjust(normalized, borrowingRate);
    const maxBorrowingRate = borrowingRate?.add(slippageTolerance);

    return this._wrapTroveChangeWithFees(
      normalized,
      await this._contracts.borrowerOperations.estimateAndPopulate.adjustTrove(
        { value: depositCollateral?.bigNumber, ...overrides },
        compose(
          borrowLUSD ? addGasForPotentialLastFeeOperationTimeUpdate : id,
          addGasForPotentialListTraversal
        ),
        maxBorrowingRate?.bigNumber ?? 0,
        withdrawCollateral?.bigNumber ?? 0,
        (borrowLUSD ?? repayLUSD)?.bigNumber ?? 0,
        !!borrowLUSD,
        ...(await this._findHints(finalTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.claimCollateralSurplus} */
  async claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.borrowerOperations.estimateAndPopulate.claimCollateral(
        { ...overrides },
        id
      )
    );
  }

  /** @internal */
  async setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    if (!priceFeedIsTestnet(this._contracts.priceFeed)) {
      throw new Error("setPrice() unavailable on this deployment of Liquity");
    }

    return this._wrapSimpleTransaction(
      await this._contracts.priceFeed.estimateAndPopulate.setPrice(
        { ...overrides },
        id,
        Decimal.from(price).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.liquidate} */
  async liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<LiquidationDetails>> {
    if (Array.isArray(address)) {
      return this._wrapLiquidation(
        await this._contracts.troveManager.estimateAndPopulate.batchLiquidateTroves(
          { ...overrides },
          addGasForLQTYIssuance,
          address
        )
      );
    } else {
      return this._wrapLiquidation(
        await this._contracts.troveManager.estimateAndPopulate.liquidate(
          { ...overrides },
          addGasForLQTYIssuance,
          address
        )
      );
    }
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.liquidateUpTo} */
  async liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<LiquidationDetails>> {
    return this._wrapLiquidation(
      await this._contracts.troveManager.estimateAndPopulate.liquidateTroves(
        { ...overrides },
        addGasForLQTYIssuance,
        maximumNumberOfTrovesToLiquidate
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.depositLUSDInStabilityPool} */
  async depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag = AddressZero,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    const depositLUSD = Decimal.from(amount);

    return this._wrapStabilityDepositTopup(
      { depositLUSD },
      await this._contracts.stabilityPool.estimateAndPopulate.provideToSP(
        { ...overrides },
        addGasForLQTYIssuance,
        depositLUSD.bigNumber,
        frontendTag
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawLUSDFromStabilityPool} */
  async withdrawLUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._wrapStabilityDepositWithdrawal(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawGainsFromStabilityPool} */
  async withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._wrapStabilityPoolGainsWithdrawal(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawFromSP(
        { ...overrides },
        addGasForLQTYIssuance,
        Decimal.ZERO.bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.transferCollateralGainToTrove} */
  async transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<CollateralGainTransferDetails>> {
    const initialTrove = this._store?.state.trove ?? (await this._readableLiquity.getTrove());
    const deposit =
      this._store?.state.deposit ?? (await this._readableLiquity.getStabilityDeposit());
    const finalTrove = initialTrove.addCollateral(deposit.collateralGain);

    return this._wrapCollateralGainTransfer(
      await this._contracts.stabilityPool.estimateAndPopulate.withdrawETHGainToTrove(
        { ...overrides },
        compose(addGasForPotentialListTraversal, addGasForLQTYIssuance),
        ...(await this._findHints(finalTrove))
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.sendLUSD} */
  async sendLUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lusdToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.sendLQTY} */
  async sendLQTY(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyToken.estimateAndPopulate.transfer(
        { ...overrides },
        id,
        toAddress,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.redeemLUSD} */
  async redeemLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<RedemptionDetails>> {
    amount = Decimal.from(amount);

    const [
      fees,
      total,
      [
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR
      ]
    ] = await Promise.all([
      this._store?.state.fees ?? this._readableLiquity.getFees(),
      this._store?.state.total ?? this._readableLiquity.getTotal(),
      this._findRedemptionHints(amount)
    ]);

    const redemptionRate = fees.redemptionRate(amount.div(total.debt));
    const maxRedemptionRate = Decimal.min(redemptionRate.add(slippageTolerance), Decimal.ONE);

    return this._wrapRedemption(
      await this._contracts.troveManager.estimateAndPopulate.redeemCollateral(
        { ...overrides },
        addGasForPotentialLastFeeOperationTimeUpdate,
        amount.bigNumber,
        firstRedemptionHint,
        upperPartialRedemptionHint,
        lowerPartialRedemptionHint,
        partialRedemptionHintNICR.bigNumber,
        _redeemMaxIterations,
        maxRedemptionRate.bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.stakeLQTY} */
  async stakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyStaking.estimateAndPopulate.stake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.unstakeLQTY} */
  async unstakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.lqtyStaking.estimateAndPopulate.unstake(
        { ...overrides },
        id,
        Decimal.from(amount).bigNumber
      )
    );
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this.unstakeLQTY(Decimal.ZERO, overrides);
  }

  /** {@inheritDoc @liquity/lib-base#PopulatableLiquity.registerFrontend} */
  async registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<PopulatedEthersLiquityTransaction<void>> {
    return this._wrapSimpleTransaction(
      await this._contracts.stabilityPool.estimateAndPopulate.registerFrontEnd(
        { ...overrides },
        id,
        Decimal.from(kickbackRate).bigNumber
      )
    );
  }
}

const sendTransaction = <T>(tx: PopulatedEthersLiquityTransaction<T>) => tx.send();

/**
 * Ethers-based implementation of {@link @liquity/lib-base#SendableLiquity}.
 *
 * @public
 */
export class SendableEthersLiquity implements _SendableFrom<PopulatableEthersLiquity> {
  private _populate: PopulatableEthersLiquity;

  constructor(populatable: PopulatableEthersLiquity) {
    this._populate = populatable;
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.openTrove} */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveCreationDetails>> {
    return this._populate.openTrove(params, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.closeTrove} */
  closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.adjustTrove(params, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.borrowLUSD} */
  borrowLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowLUSD(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.repayLUSD} */
  repayLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayLUSD(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.depositLUSDInStabilityPool} */
  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositLUSDInStabilityPool(amount, frontendTag, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawLUSDFromStabilityPool} */
  withdrawLUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawLUSDFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.sendLUSD} */
  sendLUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.sendLUSD(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.sendLQTY} */
  sendLQTY(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.sendLQTY(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.redeemLUSD} */
  redeemLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<RedemptionDetails>> {
    return this._populate.redeemLUSD(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.stakeLQTY} */
  stakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.stakeLQTY(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.unstakeLQTY} */
  unstakeLQTY(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.unstakeLQTY(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.withdrawGainsFromStaking(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @liquity/lib-base#SendableLiquity.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersLiquityTransaction<void>> {
    return this._populate.registerFrontend(kickbackRate, overrides).then(sendTransaction);
  }
}

/**
 * Thrown by {@link TransactableEthersLiquity} functions in case of transaction failure.
 *
 * @public
 */
export class EthersTransactionFailedError extends TransactionFailedError<
  FailedReceipt<EthersTransactionReceipt>
> {
  constructor(message: string, failedReceipt: FailedReceipt<EthersTransactionReceipt>) {
    super("EthersTransactionFailedError", message, failedReceipt);
  }
}

const waitForSuccess = async <T>(tx: SentEthersLiquityTransaction<T>) => {
  const receipt = await tx.waitForReceipt();

  if (receipt.status !== "succeeded") {
    throw new EthersTransactionFailedError("Transaction failed", receipt);
  }

  return receipt.details;
};

/**
 * Ethers-based implementation of {@link @liquity/lib-base#TransactableLiquity}.
 *
 * @public
 */
export class TransactableEthersLiquity implements _TransactableFrom<SendableEthersLiquity> {
  private _send: SendableEthersLiquity;

  constructor(sendable: SendableEthersLiquity) {
    this._send = sendable;
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.openTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveCreationDetails> {
    return this._send.openTrove(params, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.closeTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  closeTrove(overrides?: EthersTransactionOverrides): Promise<TroveClosureDetails> {
    return this._send.closeTrove(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.adjustTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this._send.adjustTrove(params, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.depositCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this._send.depositCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.withdrawCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this._send.withdrawCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.borrowLUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  borrowLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this._send.borrowLUSD(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.repayLUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  repayLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this._send.repayLUSD(amount, overrides).then(waitForSuccess);
  }

  /** @internal */
  setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.setPrice(price, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.liquidate}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this._send.liquidate(address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.liquidateUpTo}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this._send
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.depositLUSDInStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  depositLUSDInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this._send
      .depositLUSDInStabilityPool(amount, frontendTag, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.withdrawLUSDFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawLUSDFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this._send.withdrawLUSDFromStabilityPool(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.withdrawGainsFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityPoolGainsWithdrawalDetails> {
    return this._send.withdrawGainsFromStabilityPool(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.transferCollateralGainToTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<CollateralGainTransferDetails> {
    return this._send.transferCollateralGainToTrove(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.sendLUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  sendLUSD(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this._send.sendLUSD(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.sendLQTY}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  sendLQTY(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this._send.sendLQTY(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.redeemLUSD}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  redeemLUSD(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<RedemptionDetails> {
    return this._send.redeemLUSD(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.claimCollateralSurplus}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.claimCollateralSurplus(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.stakeLQTY}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  stakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.stakeLQTY(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.unstakeLQTY}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  unstakeLQTY(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.unstakeLQTY(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.withdrawGainsFromStaking}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.withdrawGainsFromStaking(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @liquity/lib-base#TransactableLiquity.registerFrontend}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   */
  registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this._send.registerFrontend(kickbackRate, overrides).then(waitForSuccess);
  }
}
