import { BlockTag } from "@ethersproject/abstract-provider";

import {
  CollateralGainTransferDetails,
  Decimal,
  Decimalish,
  FailedReceipt,
  Fees,
  FrontendStatus,
  LiquidationDetails,
  StabilioStore,
  STBLStake,
  RedemptionDetails,
  StabilityDeposit,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TransactableStabilio,
  TransactionFailedError,
  Trove,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams,
  TroveListingParams,
  TroveWithPendingRedistribution,
  UserTrove
} from "@stabilio/lib-base";

import {
  EthersStabilioConnection,
  EthersStabilioConnectionOptionalParams,
  EthersStabilioStoreOption,
  _connect,
  _usingStore
} from "./EthersStabilioConnection";

import {
  EthersCallOverrides,
  EthersProvider,
  EthersSigner,
  EthersTransactionOverrides,
  EthersTransactionReceipt
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersStabilio,
  SentEthersStabilioTransaction
} from "./PopulatableEthersStabilio";
import { ReadableEthersStabilio, ReadableEthersStabilioWithStore } from "./ReadableEthersStabilio";
import { SendableEthersStabilio } from "./SendableEthersStabilio";
import { BlockPolledStabilioStore } from "./BlockPolledStabilioStore";

/**
 * Thrown by {@link EthersStabilio} in case of transaction failure.
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

const waitForSuccess = async <T>(tx: SentEthersStabilioTransaction<T>) => {
  const receipt = await tx.waitForReceipt();

  if (receipt.status !== "succeeded") {
    throw new EthersTransactionFailedError("Transaction failed", receipt);
  }

  return receipt.details;
};

/**
 * Convenience class that combines multiple interfaces of the library in one object.
 *
 * @public
 */
export class EthersStabilio implements ReadableEthersStabilio, TransactableStabilio {
  /** Information about the connection to the Stabilio protocol. */
  readonly connection: EthersStabilioConnection;

  /** Can be used to create populated (unsigned) transactions. */
  readonly populate: PopulatableEthersStabilio;

  /** Can be used to send transactions without waiting for them to be mined. */
  readonly send: SendableEthersStabilio;

  private _readable: ReadableEthersStabilio;

  /** @internal */
  constructor(readable: ReadableEthersStabilio) {
    this._readable = readable;
    this.connection = readable.connection;
    this.populate = new PopulatableEthersStabilio(readable);
    this.send = new SendableEthersStabilio(this.populate);
  }

  /** @internal */
  static _from(
    connection: EthersStabilioConnection & { useStore: "blockPolled" }
  ): EthersStabilioWithStore<BlockPolledStabilioStore>;

  /** @internal */
  static _from(connection: EthersStabilioConnection): EthersStabilio;

  /** @internal */
  static _from(connection: EthersStabilioConnection): EthersStabilio {
    if (_usingStore(connection)) {
      return new _EthersStabilioWithStore(ReadableEthersStabilio._from(connection));
    } else {
      return new EthersStabilio(ReadableEthersStabilio._from(connection));
    }
  }

  /** @internal */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams: EthersStabilioConnectionOptionalParams & { useStore: "blockPolled" }
  ): Promise<EthersStabilioWithStore<BlockPolledStabilioStore>>;

  /**
   * Connect to the Stabilio protocol and create an `EthersStabilio` object.
   *
   * @param signerOrProvider - Ethers `Signer` or `Provider` to use for connecting to the Ethereum
   *                           network.
   * @param optionalParams - Optional parameters that can be used to customize the connection.
   */
  static connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersStabilioConnectionOptionalParams
  ): Promise<EthersStabilio>;

  static async connect(
    signerOrProvider: EthersSigner | EthersProvider,
    optionalParams?: EthersStabilioConnectionOptionalParams
  ): Promise<EthersStabilio> {
    return EthersStabilio._from(await _connect(signerOrProvider, optionalParams));
  }

  /**
   * Check whether this `EthersStabilio` is an {@link EthersStabilioWithStore}.
   */
  hasStore(): this is EthersStabilioWithStore;

  /**
   * Check whether this `EthersStabilio` is an
   * {@link EthersStabilioWithStore}\<{@link BlockPolledStabilioStore}\>.
   */
  hasStore(store: "blockPolled"): this is EthersStabilioWithStore<BlockPolledStabilioStore>;

  hasStore(): boolean {
    return false;
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalRedistributed} */
  getTotalRedistributed(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable.getTotalRedistributed(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTroveBeforeRedistribution} */
  getTroveBeforeRedistribution(
    address?: string,
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution> {
    return this._readable.getTroveBeforeRedistribution(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTrove} */
  getTrove(address?: string, overrides?: EthersCallOverrides): Promise<UserTrove> {
    return this._readable.getTrove(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getNumberOfTroves} */
  getNumberOfTroves(overrides?: EthersCallOverrides): Promise<number> {
    return this._readable.getNumberOfTroves(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getPrice} */
  getPrice(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getPrice(overrides);
  }

  /** @internal */
  _getActivePool(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable._getActivePool(overrides);
  }

  /** @internal */
  _getDefaultPool(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable._getDefaultPool(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotal} */
  getTotal(overrides?: EthersCallOverrides): Promise<Trove> {
    return this._readable.getTotal(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getStabilityDeposit} */
  getStabilityDeposit(address?: string, overrides?: EthersCallOverrides): Promise<StabilityDeposit> {
    return this._readable.getStabilityDeposit(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingStabilityPoolSTBLReward} */
  getRemainingStabilityPoolSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingStabilityPoolSTBLReward(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXBRLInStabilityPool} */
  getXBRLInStabilityPool(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXBRLInStabilityPool(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXBRLBalance} */
  getXBRLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXBRLBalance(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getSTBLBalance} */
  getSTBLBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getSTBLBalance(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethUniTokenBalance} */
  getXbrlWethUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlWethUniTokenBalance(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethUniTokenAllowance} */
  getXbrlWethUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlWethUniTokenAllowance(address, overrides);
  }

  /** @internal */
  _getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    return this._readable._getRemainingXbrlWethLiquidityMiningSTBLRewardCalculator(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingXbrlWethLiquidityMiningSTBLReward} */
  getRemainingXbrlWethLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingXbrlWethLiquidityMiningSTBLReward(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethLiquidityMiningStake} */
  getXbrlWethLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlWethLiquidityMiningStake(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedXbrlWethUniTokens} */
  getTotalStakedXbrlWethUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedXbrlWethUniTokens(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlWethLiquidityMiningSTBLReward} */
  getXbrlWethLiquidityMiningSTBLReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlWethLiquidityMiningSTBLReward(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblUniTokenBalance} */
  getXbrlStblUniTokenBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlStblUniTokenBalance(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblUniTokenAllowance} */
  getXbrlStblUniTokenAllowance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlStblUniTokenAllowance(address, overrides);
  }

  /** @internal */
  _getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number) => Decimal> {
    return this._readable._getRemainingXbrlStblLiquidityMiningSTBLRewardCalculator(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getRemainingXbrlStblLiquidityMiningSTBLReward} */
  getRemainingXbrlStblLiquidityMiningSTBLReward(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getRemainingXbrlStblLiquidityMiningSTBLReward(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblLiquidityMiningStake} */
  getXbrlStblLiquidityMiningStake(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlStblLiquidityMiningStake(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedXbrlStblUniTokens} */
  getTotalStakedXbrlStblUniTokens(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedXbrlStblUniTokens(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getXbrlStblLiquidityMiningSTBLReward} */
  getXbrlStblLiquidityMiningSTBLReward(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getXbrlStblLiquidityMiningSTBLReward(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getCollateralSurplusBalance} */
  getCollateralSurplusBalance(address?: string, overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getCollateralSurplusBalance(address, overrides);
  }

  /** @internal */
  getTroves(
    params: TroveListingParams & { beforeRedistribution: true },
    overrides?: EthersCallOverrides
  ): Promise<TroveWithPendingRedistribution[]>;

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.(getTroves:2)} */
  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]>;

  getTroves(params: TroveListingParams, overrides?: EthersCallOverrides): Promise<UserTrove[]> {
    return this._readable.getTroves(params, overrides);
  }

  /** @internal */
  _getBlockTimestamp(blockTag?: BlockTag): Promise<number> {
    return this._readable._getBlockTimestamp(blockTag);
  }

  /** @internal */
  _getFeesFactory(
    overrides?: EthersCallOverrides
  ): Promise<(blockTimestamp: number, recoveryMode: boolean) => Fees> {
    return this._readable._getFeesFactory(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getFees} */
  getFees(overrides?: EthersCallOverrides): Promise<Fees> {
    return this._readable.getFees(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getSTBLStake} */
  getSTBLStake(address?: string, overrides?: EthersCallOverrides): Promise<STBLStake> {
    return this._readable.getSTBLStake(address, overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getTotalStakedSTBL} */
  getTotalStakedSTBL(overrides?: EthersCallOverrides): Promise<Decimal> {
    return this._readable.getTotalStakedSTBL(overrides);
  }

  /** {@inheritDoc @stabilio/lib-base#ReadableStabilio.getFrontendStatus} */
  getFrontendStatus(address?: string, overrides?: EthersCallOverrides): Promise<FrontendStatus> {
    return this._readable.getFrontendStatus(address, overrides);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.openTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveCreationDetails> {
    return this.send
      .openTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.closeTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  closeTrove(overrides?: EthersTransactionOverrides): Promise<TroveClosureDetails> {
    return this.send.closeTrove(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.adjustTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send
      .adjustTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.depositCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.depositCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawCollateral}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.withdrawCollateral(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.borrowXBRL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  borrowXBRL(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.borrowXBRL(amount, maxBorrowingRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.repayXBRL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  repayXBRL(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<TroveAdjustmentDetails> {
    return this.send.repayXBRL(amount, overrides).then(waitForSuccess);
  }

  /** @internal */
  setPrice(price: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.setPrice(price, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.liquidate}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidate(address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.liquidateUpTo}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<LiquidationDetails> {
    return this.send.liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.depositXBRLInStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  depositXBRLInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.depositXBRLInStabilityPool(amount, frontendTag, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawXBRLFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawXBRLFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityDepositChangeDetails> {
    return this.send.withdrawXBRLFromStabilityPool(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawGainsFromStabilityPool}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<StabilityPoolGainsWithdrawalDetails> {
    return this.send.withdrawGainsFromStabilityPool(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.transferCollateralGainToTrove}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<CollateralGainTransferDetails> {
    return this.send.transferCollateralGainToTrove(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.sendXBRL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  sendXBRL(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendXBRL(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.sendSTBL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  sendSTBL(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send.sendSTBL(toAddress, amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.redeemXBRL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  redeemXBRL(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<RedemptionDetails> {
    return this.send.redeemXBRL(amount, maxRedemptionRate, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.claimCollateralSurplus}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  claimCollateralSurplus(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.claimCollateralSurplus(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.stakeSTBL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  stakeSTBL(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeSTBL(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.unstakeSTBL}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  unstakeSTBL(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeSTBL(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawGainsFromStaking}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawGainsFromStaking(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawGainsFromStaking(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.registerFrontend}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  registerFrontend(kickbackRate: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.registerFrontend(kickbackRate, overrides).then(waitForSuccess);
  }

  /** @internal */
  _mintXbrlWethUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send._mintXbrlWethUniToken(amount, address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.approveXbrlWethUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  approveXbrlWethUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.approveXbrlWethUniTokens(allowance, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.stakeXbrlWethUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  stakeXbrlWethUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeXbrlWethUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.unstakeXbrlWethUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  unstakeXbrlWethUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeXbrlWethUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawSTBLRewardFromXbrlWethLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawSTBLRewardFromXbrlWethLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawSTBLRewardFromXbrlWethLiquidityMining(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.exitXbrlWethLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  exitXbrlWethLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.exitXbrlWethLiquidityMining(overrides).then(waitForSuccess);
  }

  /** @internal */
  _mintXbrlStblUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<void> {
    return this.send._mintXbrlStblUniToken(amount, address, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.approveXbrlStblUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  approveXbrlStblUniTokens(allowance?: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.approveXbrlStblUniTokens(allowance, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.stakeXbrlStblUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  stakeXbrlStblUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.stakeXbrlStblUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.unstakeXbrlStblUniTokens}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  unstakeXbrlStblUniTokens(amount: Decimalish, overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.unstakeXbrlStblUniTokens(amount, overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.withdrawSTBLRewardFromXbrlStblLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  withdrawSTBLRewardFromXbrlStblLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.withdrawSTBLRewardFromXbrlStblLiquidityMining(overrides).then(waitForSuccess);
  }

  /**
   * {@inheritDoc @stabilio/lib-base#TransactableStabilio.exitXbrlStblLiquidityMining}
   *
   * @throws
   * Throws {@link EthersTransactionFailedError} in case of transaction failure.
   * Throws {@link EthersTransactionCancelledError} if the transaction is cancelled or replaced.
   */
  exitXbrlStblLiquidityMining(overrides?: EthersTransactionOverrides): Promise<void> {
    return this.send.exitXbrlStblLiquidityMining(overrides).then(waitForSuccess);
  }
}

/**
 * Variant of {@link EthersStabilio} that exposes a {@link @stabilio/lib-base#StabilioStore}.
 *
 * @public
 */
export interface EthersStabilioWithStore<T extends StabilioStore = StabilioStore>
  extends EthersStabilio {
  /** An object that implements StabilioStore. */
  readonly store: T;
}

class _EthersStabilioWithStore<T extends StabilioStore = StabilioStore>
  extends EthersStabilio
  implements EthersStabilioWithStore<T> {
  readonly store: T;

  constructor(readable: ReadableEthersStabilioWithStore<T>) {
    super(readable);

    this.store = readable.store;
  }

  hasStore(store?: EthersStabilioStoreOption): boolean {
    return store === undefined || store === this.connection.useStore;
  }
}
