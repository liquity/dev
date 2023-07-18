import {
  CollateralGainTransferDetails,
  Decimalish,
  LiquidationDetails,
  RedemptionDetails,
  SendableStabilio,
  StabilityDepositChangeDetails,
  StabilityPoolGainsWithdrawalDetails,
  TroveAdjustmentDetails,
  TroveAdjustmentParams,
  TroveClosureDetails,
  TroveCreationDetails,
  TroveCreationParams
} from "@stabilio/lib-base";

import {
  EthersTransactionOverrides,
  EthersTransactionReceipt,
  EthersTransactionResponse
} from "./types";

import {
  BorrowingOperationOptionalParams,
  PopulatableEthersStabilio,
  PopulatedEthersStabilioTransaction,
  SentEthersStabilioTransaction
} from "./PopulatableEthersStabilio";

const sendTransaction = <T>(tx: PopulatedEthersStabilioTransaction<T>) => tx.send();

/**
 * Ethers-based implementation of {@link @stabilio/lib-base#SendableStabilio}.
 *
 * @public
 */
export class SendableEthersStabilio
  implements SendableStabilio<EthersTransactionReceipt, EthersTransactionResponse> {
  private _populate: PopulatableEthersStabilio;

  constructor(populatable: PopulatableEthersStabilio) {
    this._populate = populatable;
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.openTrove} */
  async openTrove(
    params: TroveCreationParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveCreationDetails>> {
    return this._populate
      .openTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.closeTrove} */
  closeTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveClosureDetails>> {
    return this._populate.closeTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.adjustTrove} */
  adjustTrove(
    params: TroveAdjustmentParams<Decimalish>,
    maxBorrowingRateOrOptionalParams?: Decimalish | BorrowingOperationOptionalParams,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveAdjustmentDetails>> {
    return this._populate
      .adjustTrove(params, maxBorrowingRateOrOptionalParams, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.depositCollateral} */
  depositCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveAdjustmentDetails>> {
    return this._populate.depositCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.withdrawCollateral} */
  withdrawCollateral(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveAdjustmentDetails>> {
    return this._populate.withdrawCollateral(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.borrowXBRL} */
  borrowXBRL(
    amount: Decimalish,
    maxBorrowingRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveAdjustmentDetails>> {
    return this._populate.borrowXBRL(amount, maxBorrowingRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.repayXBRL} */
  repayXBRL(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<TroveAdjustmentDetails>> {
    return this._populate.repayXBRL(amount, overrides).then(sendTransaction);
  }

  /** @internal */
  setPrice(
    price: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.setPrice(price, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.liquidate} */
  liquidate(
    address: string | string[],
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<LiquidationDetails>> {
    return this._populate.liquidate(address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.liquidateUpTo} */
  liquidateUpTo(
    maximumNumberOfTrovesToLiquidate: number,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<LiquidationDetails>> {
    return this._populate
      .liquidateUpTo(maximumNumberOfTrovesToLiquidate, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.depositXBRLInStabilityPool} */
  depositXBRLInStabilityPool(
    amount: Decimalish,
    frontendTag?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<StabilityDepositChangeDetails>> {
    return this._populate
      .depositXBRLInStabilityPool(amount, frontendTag, overrides)
      .then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.withdrawXBRLFromStabilityPool} */
  withdrawXBRLFromStabilityPool(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<StabilityDepositChangeDetails>> {
    return this._populate.withdrawXBRLFromStabilityPool(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.withdrawGainsFromStabilityPool} */
  withdrawGainsFromStabilityPool(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<StabilityPoolGainsWithdrawalDetails>> {
    return this._populate.withdrawGainsFromStabilityPool(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.transferCollateralGainToTrove} */
  transferCollateralGainToTrove(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<CollateralGainTransferDetails>> {
    return this._populate.transferCollateralGainToTrove(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.sendXBRL} */
  sendXBRL(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.sendXBRL(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.sendSTBL} */
  sendSTBL(
    toAddress: string,
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.sendSTBL(toAddress, amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.redeemXBRL} */
  redeemXBRL(
    amount: Decimalish,
    maxRedemptionRate?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<RedemptionDetails>> {
    return this._populate.redeemXBRL(amount, maxRedemptionRate, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.claimCollateralSurplus} */
  claimCollateralSurplus(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.claimCollateralSurplus(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.stakeSTBL} */
  stakeSTBL(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.stakeSTBL(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.unstakeSTBL} */
  unstakeSTBL(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.unstakeSTBL(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.withdrawGainsFromStaking} */
  withdrawGainsFromStaking(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.withdrawGainsFromStaking(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.registerFrontend} */
  registerFrontend(
    kickbackRate: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.registerFrontend(kickbackRate, overrides).then(sendTransaction);
  }

  /** @internal */
  _mintXbrlWethUniToken(
    amount: Decimalish,
    address?: string,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate._mintXbrlWethUniToken(amount, address, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.approveXbrlWethUniTokens} */
  approveXbrlWethUniTokens(
    allowance?: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.approveXbrlWethUniTokens(allowance, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.stakeXbrlWethUniTokens} */
  stakeXbrlWethUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.stakeXbrlWethUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.unstakeXbrlWethUniTokens} */
  unstakeXbrlWethUniTokens(
    amount: Decimalish,
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.unstakeXbrlWethUniTokens(amount, overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.withdrawSTBLRewardFromXbrlWethLiquidityMining} */
  withdrawSTBLRewardFromXbrlWethLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.withdrawSTBLRewardFromXbrlWethLiquidityMining(overrides).then(sendTransaction);
  }

  /** {@inheritDoc @stabilio/lib-base#SendableStabilio.exitXbrlWethLiquidityMining} */
  exitXbrlWethLiquidityMining(
    overrides?: EthersTransactionOverrides
  ): Promise<SentEthersStabilioTransaction<void>> {
    return this._populate.exitXbrlWethLiquidityMining(overrides).then(sendTransaction);
  }
}
