
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";
import { BytesLike } from "@ethersproject/bytes";
import {
  Overrides,
  CallOverrides,
  PayableOverrides,
  ContractTransaction,
  EventFilter
} from "@ethersproject/contracts";

import { TypedLiquityContract, TypedLogDescription } from "../src/contracts";

interface ActivePoolFunctions {
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  decreaseLUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  defaultPoolAddress(_overrides?: CallOverrides): Promise<string>;
  getETH(_overrides?: CallOverrides): Promise<BigNumber>;
  getLUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  increaseLUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sendETH(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  setAddresses(_borrowerOperationsAddress: string, _troveManagerAddress: string, _stabilityPoolAddress: string, _defaultPoolAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

export interface ActivePool
  extends TypedLiquityContract<ActivePoolFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    ETHBalanceUpdated(_newBalance?: null): EventFilter;
    EtherSent(_to?: null, _amount?: null): EventFilter;
    LUSDBalanceUpdated(_newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "ETHBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "EtherSent"): TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "LUSDBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface BorrowerOperationsFunctions {
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  LUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  addColl(_upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<ContractTransaction>;
  adjustTrove(_maxFeePercentage: BigNumberish, _collWithdrawal: BigNumberish, _debtChange: BigNumberish, _isDebtIncrease: boolean, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<ContractTransaction>;
  claimCollateral(_overrides?: Overrides): Promise<ContractTransaction>;
  closeTrove(_overrides?: Overrides): Promise<ContractTransaction>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getCompositeDebt(_debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lqtyStaking(_overrides?: CallOverrides): Promise<string>;
  lqtyStakingAddress(_overrides?: CallOverrides): Promise<string>;
  lusdToken(_overrides?: CallOverrides): Promise<string>;
  moveETHGainToTrove(_borrower: string, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<ContractTransaction>;
  openTrove(_maxFeePercentage: BigNumberish, _LUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: PayableOverrides): Promise<ContractTransaction>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  repayLUSD(_LUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<ContractTransaction>;
  setAddresses(_troveManagerAddress: string, _activePoolAddress: string, _defaultPoolAddress: string, _stabilityPoolAddress: string, _gasPoolAddress: string, _collSurplusPoolAddress: string, _priceFeedAddress: string, _sortedTrovesAddress: string, _lusdTokenAddress: string, _lqtyStakingAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  withdrawColl(_collWithdrawal: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<ContractTransaction>;
  withdrawLUSD(_maxFeePercentage: BigNumberish, _LUSDAmount: BigNumberish, _upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface BorrowerOperations
  extends TypedLiquityContract<BorrowerOperationsFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    LQTYStakingAddressChanged(_lqtyStakingAddress?: null): EventFilter;
    LUSDBorrowingFeePaid(_borrower?: string | null, _LUSDFee?: null): EventFilter;
    LUSDTokenAddressChanged(_lusdTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    TroveCreated(_borrower?: string | null, arrayIndex?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    TroveUpdated(_borrower?: string | null, _debt?: null, _coll?: null, stake?: null, operation?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "LQTYStakingAddressChanged"): TypedLogDescription<{ _lqtyStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "LUSDBorrowingFeePaid"): TypedLogDescription<{ _borrower: string; _LUSDFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "LUSDTokenAddressChanged"): TypedLogDescription<{ _lusdTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveCreated"): TypedLogDescription<{ _borrower: string; arrayIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; stake: BigNumber; operation: number }>[];
}

interface TroveManagerFunctions {
  BETA(_overrides?: CallOverrides): Promise<BigNumber>;
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  LUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  L_ETH(_overrides?: CallOverrides): Promise<BigNumber>;
  L_LUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  MINUTE_DECAY_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  TroveOwners(arg0: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  Troves(arg0: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; stake: BigNumber; status: number; arrayIndex: BigNumber }>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  addTroveOwnerToArray(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  applyPendingRewards(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  baseRate(_overrides?: CallOverrides): Promise<BigNumber>;
  batchLiquidateTroves(_troveArray: string[], _overrides?: Overrides): Promise<ContractTransaction>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  checkRecoveryMode(_overrides?: CallOverrides): Promise<boolean>;
  closeTrove(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  decayBaseRateFromBorrowing(_overrides?: Overrides): Promise<ContractTransaction>;
  decreaseTroveColl(_borrower: string, _collDecrease: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  decreaseTroveDebt(_borrower: string, _debtDecrease: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getBorrowingFee(_LUSDDebt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getCurrentICR(_borrower: string, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  getEntireDebtAndColl(_borrower: string, _overrides?: CallOverrides): Promise<{ debt: BigNumber; coll: BigNumber; pendingLUSDDebtReward: BigNumber; pendingETHReward: BigNumber }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getNominalICR(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingETHReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingLUSDDebtReward(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTCR(_overrides?: CallOverrides): Promise<BigNumber>;
  getTroveColl(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveDebt(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveFromTroveOwnersArray(_index: BigNumberish, _overrides?: CallOverrides): Promise<string>;
  getTroveOwnersCount(_overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStake(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTroveStatus(_borrower: string, _overrides?: CallOverrides): Promise<BigNumber>;
  hasPendingRewards(_borrower: string, _overrides?: CallOverrides): Promise<boolean>;
  increaseTroveColl(_borrower: string, _collIncrease: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  increaseTroveDebt(_borrower: string, _debtIncrease: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastETHError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  lastFeeOperationTime(_overrides?: CallOverrides): Promise<BigNumber>;
  lastLUSDDebtError_Redistribution(_overrides?: CallOverrides): Promise<BigNumber>;
  liquidate(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  liquidateTroves(_n: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  lqtyStaking(_overrides?: CallOverrides): Promise<string>;
  lusdToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  redeemCollateral(_LUSDamount: BigNumberish, _firstRedemptionHint: string, _upperPartialRedemptionHint: string, _lowerPartialRedemptionHint: string, _partialRedemptionHintNICR: BigNumberish, _maxIterations: BigNumberish, _maxFeePercentage: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  removeStake(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  rewardSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ ETH: BigNumber; LUSDDebt: BigNumber }>;
  setAddresses(_borrowerOperationsAddress: string, _activePoolAddress: string, _defaultPoolAddress: string, _stabilityPoolAddress: string, _gasPoolAddress: string, _collSurplusPoolAddress: string, _priceFeedAddress: string, _lusdTokenAddress: string, _sortedTrovesAddress: string, _lqtyStakingAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  setTroveStatus(_borrower: string, _num: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  stabilityPool(_overrides?: CallOverrides): Promise<string>;
  totalCollateralSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakes(_overrides?: CallOverrides): Promise<BigNumber>;
  totalStakesSnapshot(_overrides?: CallOverrides): Promise<BigNumber>;
  updateStakeAndTotalStakes(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
  updateTroveRewardSnapshots(_borrower: string, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface TroveManager
  extends TypedLiquityContract<TroveManagerFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_activePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollSurplusPoolAddressChanged(_collSurplusPoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_defaultPoolAddress?: null): EventFilter;
    GasPoolAddressChanged(_gasPoolAddress?: null): EventFilter;
    LQTYStakingAddressChanged(_lqtyStakingAddress?: null): EventFilter;
    LUSDTokenAddressChanged(_newLUSDTokenAddress?: null): EventFilter;
    Liquidation(_liquidatedDebt?: null, _liquidatedColl?: null, _collGasCompensation?: null, _LUSDGasCompensation?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    Redemption(_attemptedLUSDAmount?: null, _actualLUSDAmount?: null, _ETHSent?: null, _ETHFee?: null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    StabilityPoolAddressChanged(_stabilityPoolAddress?: null): EventFilter;
    TroveCreated(_borrower?: string | null, _arrayIndex?: null): EventFilter;
    TroveLiquidated(_borrower?: string | null, _debt?: null, _coll?: null, _operation?: null): EventFilter;
    TroveUpdated(_borrower?: string | null, _debt?: null, _coll?: null, _stake?: null, _operation?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollSurplusPoolAddressChanged"): TypedLogDescription<{ _collSurplusPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): TypedLogDescription<{ _defaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "GasPoolAddressChanged"): TypedLogDescription<{ _gasPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "LQTYStakingAddressChanged"): TypedLogDescription<{ _lqtyStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "LUSDTokenAddressChanged"): TypedLogDescription<{ _newLUSDTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "Liquidation"): TypedLogDescription<{ _liquidatedDebt: BigNumber; _liquidatedColl: BigNumber; _collGasCompensation: BigNumber; _LUSDGasCompensation: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "Redemption"): TypedLogDescription<{ _attemptedLUSDAmount: BigNumber; _actualLUSDAmount: BigNumber; _ETHSent: BigNumber; _ETHFee: BigNumber }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): TypedLogDescription<{ _stabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveCreated"): TypedLogDescription<{ _borrower: string; _arrayIndex: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveLiquidated"): TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; _operation: number }>[];
  extractEvents(logs: Log[], name: "TroveUpdated"): TypedLogDescription<{ _borrower: string; _debt: BigNumber; _coll: BigNumber; _stake: BigNumber; _operation: number }>[];
}

interface LUSDTokenFunctions {
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  burn(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  mint(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<ContractTransaction>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  returnFromPool(_poolAddress: string, _receiver: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  sendToPool(_sender: string, _poolAddress: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
  version(_overrides?: CallOverrides): Promise<string>;
}

export interface LUSDToken
  extends TypedLiquityContract<LUSDTokenFunctions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    LUSDTokenBalanceUpdated(_user?: null, _amount?: null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "LUSDTokenBalanceUpdated"): TypedLogDescription<{ _user: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "Transfer"): TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface CommunityIssuanceFunctions {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  ISSUANCE_FACTOR(_overrides?: CallOverrides): Promise<BigNumber>;
  LQTYSupplyCap(_overrides?: CallOverrides): Promise<BigNumber>;
  SECONDS_IN_ONE_MINUTE(_overrides?: CallOverrides): Promise<BigNumber>;
  deploymentTime(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  issueLQTY(_overrides?: Overrides): Promise<ContractTransaction>;
  lqtyToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sendLQTY(_account: string, _LQTYamount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  setAddresses(_lqtyTokenAddress: string, _stabilityPoolAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  stabilityPoolAddress(_overrides?: CallOverrides): Promise<string>;
  totalLQTYIssued(_overrides?: CallOverrides): Promise<BigNumber>;
}

export interface CommunityIssuance
  extends TypedLiquityContract<CommunityIssuanceFunctions> {
  readonly filters: {
    LQTYTokenAddressSet(_lqtyTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressSet(_stabilityPoolAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LQTYTokenAddressSet"): TypedLogDescription<{ _lqtyTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressSet"): TypedLogDescription<{ _stabilityPoolAddress: string }>[];
}

interface DefaultPoolFunctions {
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  decreaseLUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  getETH(_overrides?: CallOverrides): Promise<BigNumber>;
  getLUSDDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  increaseLUSDDebt(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  sendETHToActivePool(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  setAddresses(_troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

export interface DefaultPool
  extends TypedLiquityContract<DefaultPoolFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    ETHBalanceUpdated(_newBalance?: null): EventFilter;
    EtherSent(_to?: null, _amount?: null): EventFilter;
    LUSDBalanceUpdated(_newBalance?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StabilityPoolAddressChanged(_newStabilityPoolAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "ETHBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "EtherSent"): TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "LUSDBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StabilityPoolAddressChanged"): TypedLogDescription<{ _newStabilityPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}

interface LQTYTokenFunctions {
  ONE_YEAR_IN_SECONDS(_overrides?: CallOverrides): Promise<BigNumber>;
  allowance(owner: string, spender: string, _overrides?: CallOverrides): Promise<BigNumber>;
  approve(spender: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  balanceOf(account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  communityIssuanceAddress(_overrides?: CallOverrides): Promise<string>;
  decimals(_overrides?: CallOverrides): Promise<number>;
  decreaseAllowance(spender: string, subtractedValue: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  deployer(_overrides?: CallOverrides): Promise<string>;
  domainSeparator(_overrides?: CallOverrides): Promise<string>;
  getDeploymentStartTime(_overrides?: CallOverrides): Promise<BigNumber>;
  getLpRewardsEntitlement(_overrides?: CallOverrides): Promise<BigNumber>;
  increaseAllowance(spender: string, addedValue: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  lockupContractFactory(_overrides?: CallOverrides): Promise<string>;
  lqtyStakingAddress(_overrides?: CallOverrides): Promise<string>;
  name(_overrides?: CallOverrides): Promise<string>;
  nonces(owner: string, _overrides?: CallOverrides): Promise<BigNumber>;
  permit(owner: string, spender: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, _overrides?: Overrides): Promise<ContractTransaction>;
  permitTypeHash(_overrides?: CallOverrides): Promise<string>;
  sendToLQTYStaking(_sender: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  symbol(_overrides?: CallOverrides): Promise<string>;
  totalSupply(_overrides?: CallOverrides): Promise<BigNumber>;
  transfer(recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  transferFrom(sender: string, recipient: string, amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  version(_overrides?: CallOverrides): Promise<string>;
}

export interface LQTYToken
  extends TypedLiquityContract<LQTYTokenFunctions> {
  readonly filters: {
    Approval(owner?: string | null, spender?: string | null, value?: null): EventFilter;
    CommunityIssuanceAddressSet(_communityIssuanceAddress?: null): EventFilter;
    LQTYStakingAddressSet(_lqtyStakingAddress?: null): EventFilter;
    LockupContractFactoryAddressSet(_lockupContractFactoryAddress?: null): EventFilter;
    Transfer(from?: string | null, to?: string | null, value?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "Approval"): TypedLogDescription<{ owner: string; spender: string; value: BigNumber }>[];
  extractEvents(logs: Log[], name: "CommunityIssuanceAddressSet"): TypedLogDescription<{ _communityIssuanceAddress: string }>[];
  extractEvents(logs: Log[], name: "LQTYStakingAddressSet"): TypedLogDescription<{ _lqtyStakingAddress: string }>[];
  extractEvents(logs: Log[], name: "LockupContractFactoryAddressSet"): TypedLogDescription<{ _lockupContractFactoryAddress: string }>[];
  extractEvents(logs: Log[], name: "Transfer"): TypedLogDescription<{ from: string; to: string; value: BigNumber }>[];
}

interface HintHelpersFunctions {
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  LUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  computeCR(_coll: BigNumberish, _debt: BigNumberish, _price: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  computeNominalCR(_coll: BigNumberish, _debt: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  getApproxHint(_CR: BigNumberish, _numTrials: BigNumberish, _inputRandomSeed: BigNumberish, _overrides?: CallOverrides): Promise<{ hintAddress: string; diff: BigNumber; latestRandomSeed: BigNumber }>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getRedemptionHints(_LUSDamount: BigNumberish, _price: BigNumberish, _maxIterations: BigNumberish, _overrides?: CallOverrides): Promise<{ firstRedemptionHint: string; partialRedemptionHintNICR: BigNumber }>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  setAddresses(_sortedTrovesAddress: string, _troveManagerAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

export interface HintHelpers
  extends TypedLiquityContract<HintHelpersFunctions> {
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedTrovesAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): TypedLogDescription<{ _sortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface LockupContractFactoryFunctions {
  SECONDS_IN_ONE_YEAR(_overrides?: CallOverrides): Promise<BigNumber>;
  deployLockupContract(_beneficiary: string, _unlockTime: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  isRegisteredLockup(_contractAddress: string, _overrides?: CallOverrides): Promise<boolean>;
  lockupContractToDeployer(arg0: string, _overrides?: CallOverrides): Promise<string>;
  lqtyTokenAddress(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  setLQTYTokenAddress(_lqtyTokenAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface LockupContractFactory
  extends TypedLiquityContract<LockupContractFactoryFunctions> {
  readonly filters: {
    LQTYTokenAddressSet(_lqtyTokenAddress?: null): EventFilter;
    LockupContractDeployed(_lockupContractAddress?: null, _beneficiary?: null, _unlockTime?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "LQTYTokenAddressSet"): TypedLogDescription<{ _lqtyTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "LockupContractDeployed"): TypedLogDescription<{ _lockupContractAddress: string; _beneficiary: string; _unlockTime: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface LQTYStakingFunctions {
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  F_ETH(_overrides?: CallOverrides): Promise<BigNumber>;
  F_LUSD(_overrides?: CallOverrides): Promise<BigNumber>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  getPendingETHGain(_user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getPendingLUSDGain(_user: string, _overrides?: CallOverrides): Promise<BigNumber>;
  increaseF_ETH(_ETHFee: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  increaseF_LUSD(_LUSDFee: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lqtyToken(_overrides?: CallOverrides): Promise<string>;
  lusdToken(_overrides?: CallOverrides): Promise<string>;
  owner(_overrides?: CallOverrides): Promise<string>;
  setAddresses(_lqtyTokenAddress: string, _lusdTokenAddress: string, _troveManagerAddress: string, _borrowerOperationsAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  snapshots(arg0: string, _overrides?: CallOverrides): Promise<{ F_ETH_Snapshot: BigNumber; F_LUSD_Snapshot: BigNumber }>;
  stake(_LQTYamount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  stakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  totalLQTYStaked(_overrides?: CallOverrides): Promise<BigNumber>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
  unstake(_LQTYamount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface LQTYStaking
  extends TypedLiquityContract<LQTYStakingFunctions> {
  readonly filters: {
    ActivePoolAddressSet(_activePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressSet(_borrowerOperationsAddress?: null): EventFilter;
    LQTYTokenAddressSet(_lqtyTokenAddress?: null): EventFilter;
    LUSDTokenAddressSet(_lusdTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    StakeChanged(staker?: string | null, newStake?: null): EventFilter;
    StakingGainsWithdrawn(staker?: string | null, LUSDGain?: null, ETHGain?: null): EventFilter;
    TroveManagerAddressSet(_troveManager?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressSet"): TypedLogDescription<{ _activePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressSet"): TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "LQTYTokenAddressSet"): TypedLogDescription<{ _lqtyTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "LUSDTokenAddressSet"): TypedLogDescription<{ _lusdTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "StakeChanged"): TypedLogDescription<{ staker: string; newStake: BigNumber }>[];
  extractEvents(logs: Log[], name: "StakingGainsWithdrawn"): TypedLogDescription<{ staker: string; LUSDGain: BigNumber; ETHGain: BigNumber }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressSet"): TypedLogDescription<{ _troveManager: string }>[];
}

interface MultiTroveGetterFunctions {
  getMultipleSortedTroves(_startIdx: BigNumberish, _count: BigNumberish, _overrides?: CallOverrides): Promise<{ owner: string; debt: BigNumber; coll: BigNumber; stake: BigNumber; snapshotETH: BigNumber; snapshotLUSDDebt: BigNumber }[]>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
}

export interface MultiTroveGetter
  extends TypedLiquityContract<MultiTroveGetterFunctions> {
  readonly filters: {
  };
}

interface PriceFeedFunctions {
  TARGET_DIGITS(_overrides?: CallOverrides): Promise<BigNumber>;
  getPrice(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceAggregator(_overrides?: CallOverrides): Promise<string>;
  setAddresses(_priceAggregatorAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface PriceFeed
  extends TypedLiquityContract<PriceFeedFunctions> {
  readonly filters: {
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
  };
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
}

interface PriceFeedTestnetFunctions {
  getPrice(_overrides?: CallOverrides): Promise<BigNumber>;
  setPrice(price: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface PriceFeedTestnet
  extends TypedLiquityContract<PriceFeedTestnetFunctions> {
  readonly filters: {
  };
}

interface SortedTrovesFunctions {
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  contains(_id: string, _overrides?: CallOverrides): Promise<boolean>;
  data(_overrides?: CallOverrides): Promise<{ head: string; tail: string; maxSize: BigNumber; size: BigNumber }>;
  findInsertPosition(_NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<[string, string]>;
  getFirst(_overrides?: CallOverrides): Promise<string>;
  getLast(_overrides?: CallOverrides): Promise<string>;
  getMaxSize(_overrides?: CallOverrides): Promise<BigNumber>;
  getNext(_id: string, _overrides?: CallOverrides): Promise<string>;
  getPrev(_id: string, _overrides?: CallOverrides): Promise<string>;
  getSize(_overrides?: CallOverrides): Promise<BigNumber>;
  insert(_id: string, _NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<ContractTransaction>;
  isEmpty(_overrides?: CallOverrides): Promise<boolean>;
  isFull(_overrides?: CallOverrides): Promise<boolean>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  reInsert(_id: string, _newNICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: Overrides): Promise<ContractTransaction>;
  remove(_id: string, _overrides?: Overrides): Promise<ContractTransaction>;
  setParams(_size: BigNumberish, _troveManagerAddress: string, _borrowerOperationsAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
  validInsertPosition(_NICR: BigNumberish, _prevId: string, _nextId: string, _overrides?: CallOverrides): Promise<boolean>;
}

export interface SortedTroves
  extends TypedLiquityContract<SortedTrovesFunctions> {
  readonly filters: {
    BorrowerOperationsAddressChanged(_borrowerOperationsAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    SortedTrovesAddressChanged(_sortedDoublyLLAddress?: null): EventFilter;
    TroveManagerAddressChanged(_troveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _borrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): TypedLogDescription<{ _sortedDoublyLLAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _troveManagerAddress: string }>[];
}

interface StabilityPoolFunctions {
  CCR(_overrides?: CallOverrides): Promise<BigNumber>;
  DECIMAL_PRECISION(_overrides?: CallOverrides): Promise<BigNumber>;
  LUSD_GAS_COMPENSATION(_overrides?: CallOverrides): Promise<BigNumber>;
  MCR(_overrides?: CallOverrides): Promise<BigNumber>;
  P(_overrides?: CallOverrides): Promise<BigNumber>;
  PERCENT_DIVISOR(_overrides?: CallOverrides): Promise<BigNumber>;
  _100pct(_overrides?: CallOverrides): Promise<BigNumber>;
  activePool(_overrides?: CallOverrides): Promise<string>;
  borrowerOperations(_overrides?: CallOverrides): Promise<string>;
  communityIssuance(_overrides?: CallOverrides): Promise<string>;
  currentEpoch(_overrides?: CallOverrides): Promise<BigNumber>;
  currentScale(_overrides?: CallOverrides): Promise<BigNumber>;
  defaultPool(_overrides?: CallOverrides): Promise<string>;
  depositSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  deposits(arg0: string, _overrides?: CallOverrides): Promise<{ initialValue: BigNumber; frontEndTag: string }>;
  epochToScaleToG(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  epochToScaleToSum(arg0: BigNumberish, arg1: BigNumberish, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEndSnapshots(arg0: string, _overrides?: CallOverrides): Promise<{ S: BigNumber; P: BigNumber; G: BigNumber; scale: BigNumber; epoch: BigNumber }>;
  frontEndStakes(arg0: string, _overrides?: CallOverrides): Promise<BigNumber>;
  frontEnds(arg0: string, _overrides?: CallOverrides): Promise<{ kickbackRate: BigNumber; registered: boolean }>;
  getCompoundedFrontEndStake(_frontEnd: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getCompoundedLUSDDeposit(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorETHGain(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getDepositorLQTYGain(_depositor: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getETH(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemColl(_overrides?: CallOverrides): Promise<BigNumber>;
  getEntireSystemDebt(_overrides?: CallOverrides): Promise<BigNumber>;
  getFrontEndLQTYGain(_frontEnd: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getTotalLUSDDeposits(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  lastETHError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  lastLQTYError(_overrides?: CallOverrides): Promise<BigNumber>;
  lastLUSDLossError_Offset(_overrides?: CallOverrides): Promise<BigNumber>;
  lusdToken(_overrides?: CallOverrides): Promise<string>;
  offset(_debtToOffset: BigNumberish, _collToAdd: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  owner(_overrides?: CallOverrides): Promise<string>;
  priceFeed(_overrides?: CallOverrides): Promise<string>;
  provideToSP(_amount: BigNumberish, _frontEndTag: string, _overrides?: Overrides): Promise<ContractTransaction>;
  registerFrontEnd(_kickbackRate: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  setAddresses(_borrowerOperationsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _lusdTokenAddress: string, _sortedTrovesAddress: string, _priceFeedAddress: string, _communityIssuanceAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  sortedTroves(_overrides?: CallOverrides): Promise<string>;
  troveManager(_overrides?: CallOverrides): Promise<string>;
  withdrawETHGainToTrove(_upperHint: string, _lowerHint: string, _overrides?: Overrides): Promise<ContractTransaction>;
  withdrawFromSP(_amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
}

export interface StabilityPool
  extends TypedLiquityContract<StabilityPoolFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CommunityIssuanceAddressChanged(_newCommunityIssuanceAddress?: null): EventFilter;
    DefaultPoolAddressChanged(_newDefaultPoolAddress?: null): EventFilter;
    DepositSnapshotUpdated(_depositor?: string | null, _P?: null, _S?: null, _G?: null): EventFilter;
    ETHBalanceUpdated(_newBalance?: null): EventFilter;
    ETHGainWithdrawn(_depositor?: string | null, _ETH?: null, _LUSDLoss?: null): EventFilter;
    EtherSent(_to?: null, _amount?: null): EventFilter;
    FrontEndRegistered(_frontEnd?: string | null, _kickbackRate?: null): EventFilter;
    FrontEndSnapshotUpdated(_frontEnd?: string | null, _P?: null, _G?: null): EventFilter;
    FrontEndStakeChanged(_frontEnd?: string | null, _newFrontEndStake?: null, _depositor?: null): EventFilter;
    G_Updated(_G?: null): EventFilter;
    LQTYPaidToDepositor(_depositor?: string | null, _LQTY?: null): EventFilter;
    LQTYPaidToFrontEnd(_frontEnd?: string | null, _LQTY?: null): EventFilter;
    LUSDBalanceUpdated(_newBalance?: null): EventFilter;
    LUSDTokenAddressChanged(_newLUSDTokenAddress?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    P_Updated(_P?: null): EventFilter;
    PriceFeedAddressChanged(_newPriceFeedAddress?: null): EventFilter;
    S_Updated(_S?: null): EventFilter;
    SortedTrovesAddressChanged(_newSortedTrovesAddress?: null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
    UserDepositChanged(_depositor?: string | null, _newDeposit?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CommunityIssuanceAddressChanged"): TypedLogDescription<{ _newCommunityIssuanceAddress: string }>[];
  extractEvents(logs: Log[], name: "DefaultPoolAddressChanged"): TypedLogDescription<{ _newDefaultPoolAddress: string }>[];
  extractEvents(logs: Log[], name: "DepositSnapshotUpdated"): TypedLogDescription<{ _depositor: string; _P: BigNumber; _S: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "ETHBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "ETHGainWithdrawn"): TypedLogDescription<{ _depositor: string; _ETH: BigNumber; _LUSDLoss: BigNumber }>[];
  extractEvents(logs: Log[], name: "EtherSent"): TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndRegistered"): TypedLogDescription<{ _frontEnd: string; _kickbackRate: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndSnapshotUpdated"): TypedLogDescription<{ _frontEnd: string; _P: BigNumber; _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "FrontEndStakeChanged"): TypedLogDescription<{ _frontEnd: string; _newFrontEndStake: BigNumber; _depositor: string }>[];
  extractEvents(logs: Log[], name: "G_Updated"): TypedLogDescription<{ _G: BigNumber }>[];
  extractEvents(logs: Log[], name: "LQTYPaidToDepositor"): TypedLogDescription<{ _depositor: string; _LQTY: BigNumber }>[];
  extractEvents(logs: Log[], name: "LQTYPaidToFrontEnd"): TypedLogDescription<{ _frontEnd: string; _LQTY: BigNumber }>[];
  extractEvents(logs: Log[], name: "LUSDBalanceUpdated"): TypedLogDescription<{ _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "LUSDTokenAddressChanged"): TypedLogDescription<{ _newLUSDTokenAddress: string }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "P_Updated"): TypedLogDescription<{ _P: BigNumber }>[];
  extractEvents(logs: Log[], name: "PriceFeedAddressChanged"): TypedLogDescription<{ _newPriceFeedAddress: string }>[];
  extractEvents(logs: Log[], name: "S_Updated"): TypedLogDescription<{ _S: BigNumber }>[];
  extractEvents(logs: Log[], name: "SortedTrovesAddressChanged"): TypedLogDescription<{ _newSortedTrovesAddress: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _newTroveManagerAddress: string }>[];
  extractEvents(logs: Log[], name: "UserDepositChanged"): TypedLogDescription<{ _depositor: string; _newDeposit: BigNumber }>[];
}

interface GasPoolFunctions {
}

export interface GasPool
  extends TypedLiquityContract<GasPoolFunctions> {
  readonly filters: {
  };
}

interface CollSurplusPoolFunctions {
  accountSurplus(_account: string, _amount: BigNumberish, _overrides?: Overrides): Promise<ContractTransaction>;
  activePoolAddress(_overrides?: CallOverrides): Promise<string>;
  borrowerOperationsAddress(_overrides?: CallOverrides): Promise<string>;
  claimColl(_account: string, _overrides?: Overrides): Promise<ContractTransaction>;
  getCollateral(_account: string, _overrides?: CallOverrides): Promise<BigNumber>;
  getETH(_overrides?: CallOverrides): Promise<BigNumber>;
  isOwner(_overrides?: CallOverrides): Promise<boolean>;
  owner(_overrides?: CallOverrides): Promise<string>;
  setAddresses(_borrowerOperationsAddress: string, _troveManagerAddress: string, _activePoolAddress: string, _overrides?: Overrides): Promise<ContractTransaction>;
  troveManagerAddress(_overrides?: CallOverrides): Promise<string>;
}

export interface CollSurplusPool
  extends TypedLiquityContract<CollSurplusPoolFunctions> {
  readonly filters: {
    ActivePoolAddressChanged(_newActivePoolAddress?: null): EventFilter;
    BorrowerOperationsAddressChanged(_newBorrowerOperationsAddress?: null): EventFilter;
    CollBalanceUpdated(_account?: string | null, _newBalance?: null): EventFilter;
    EtherSent(_to?: null, _amount?: null): EventFilter;
    OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): EventFilter;
    TroveManagerAddressChanged(_newTroveManagerAddress?: null): EventFilter;
  };
  extractEvents(logs: Log[], name: "ActivePoolAddressChanged"): TypedLogDescription<{ _newActivePoolAddress: string }>[];
  extractEvents(logs: Log[], name: "BorrowerOperationsAddressChanged"): TypedLogDescription<{ _newBorrowerOperationsAddress: string }>[];
  extractEvents(logs: Log[], name: "CollBalanceUpdated"): TypedLogDescription<{ _account: string; _newBalance: BigNumber }>[];
  extractEvents(logs: Log[], name: "EtherSent"): TypedLogDescription<{ _to: string; _amount: BigNumber }>[];
  extractEvents(logs: Log[], name: "OwnershipTransferred"): TypedLogDescription<{ previousOwner: string; newOwner: string }>[];
  extractEvents(logs: Log[], name: "TroveManagerAddressChanged"): TypedLogDescription<{ _newTroveManagerAddress: string }>[];
}
