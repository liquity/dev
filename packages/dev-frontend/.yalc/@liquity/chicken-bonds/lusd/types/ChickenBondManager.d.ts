import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export declare namespace ChickenBondManager {
    type ExternalAdressesStruct = {
        bondNFTAddress: string;
        lusdTokenAddress: string;
        curvePoolAddress: string;
        curveBasePoolAddress: string;
        bammSPVaultAddress: string;
        yearnCurveVaultAddress: string;
        yearnRegistryAddress: string;
        yearnGovernanceAddress: string;
        bLUSDTokenAddress: string;
        curveLiquidityGaugeAddress: string;
    };
    type ExternalAdressesStructOutput = [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
    ] & {
        bondNFTAddress: string;
        lusdTokenAddress: string;
        curvePoolAddress: string;
        curveBasePoolAddress: string;
        bammSPVaultAddress: string;
        yearnCurveVaultAddress: string;
        yearnRegistryAddress: string;
        yearnGovernanceAddress: string;
        bLUSDTokenAddress: string;
        curveLiquidityGaugeAddress: string;
    };
    type ParamsStruct = {
        targetAverageAgeSeconds: BigNumberish;
        initialAccrualParameter: BigNumberish;
        minimumAccrualParameter: BigNumberish;
        accrualAdjustmentRate: BigNumberish;
        accrualAdjustmentPeriodSeconds: BigNumberish;
        chickenInAMMFee: BigNumberish;
        curveDepositDydxThreshold: BigNumberish;
        curveWithdrawalDxdyThreshold: BigNumberish;
        bootstrapPeriodChickenIn: BigNumberish;
        bootstrapPeriodRedeem: BigNumberish;
        bootstrapPeriodShift: BigNumberish;
        shifterDelay: BigNumberish;
        shifterWindow: BigNumberish;
        minBLUSDSupply: BigNumberish;
        minBondAmount: BigNumberish;
        nftRandomnessDivisor: BigNumberish;
        redemptionFeeBeta: BigNumberish;
        redemptionFeeMinuteDecayFactor: BigNumberish;
    };
    type ParamsStructOutput = [
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber
    ] & {
        targetAverageAgeSeconds: BigNumber;
        initialAccrualParameter: BigNumber;
        minimumAccrualParameter: BigNumber;
        accrualAdjustmentRate: BigNumber;
        accrualAdjustmentPeriodSeconds: BigNumber;
        chickenInAMMFee: BigNumber;
        curveDepositDydxThreshold: BigNumber;
        curveWithdrawalDxdyThreshold: BigNumber;
        bootstrapPeriodChickenIn: BigNumber;
        bootstrapPeriodRedeem: BigNumber;
        bootstrapPeriodShift: BigNumber;
        shifterDelay: BigNumber;
        shifterWindow: BigNumber;
        minBLUSDSupply: BigNumber;
        minBondAmount: BigNumber;
        nftRandomnessDivisor: BigNumber;
        redemptionFeeBeta: BigNumber;
        redemptionFeeMinuteDecayFactor: BigNumber;
    };
}
export interface ChickenBondManagerInterface extends utils.Interface {
    functions: {
        "BETA()": FunctionFragment;
        "BOOTSTRAP_PERIOD_CHICKEN_IN()": FunctionFragment;
        "BOOTSTRAP_PERIOD_REDEEM()": FunctionFragment;
        "BOOTSTRAP_PERIOD_SHIFT()": FunctionFragment;
        "CHICKEN_IN_AMM_FEE()": FunctionFragment;
        "DECIMAL_PRECISION()": FunctionFragment;
        "INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL()": FunctionFragment;
        "MINUTE_DECAY_FACTOR()": FunctionFragment;
        "MIN_BLUSD_SUPPLY()": FunctionFragment;
        "MIN_BOND_AMOUNT()": FunctionFragment;
        "NFT_RANDOMNESS_DIVISOR()": FunctionFragment;
        "SECONDS_IN_ONE_MINUTE()": FunctionFragment;
        "SHIFTER_DELAY()": FunctionFragment;
        "SHIFTER_WINDOW()": FunctionFragment;
        "_calcSystemBackingRatioFromBAMMValue(uint256)": FunctionFragment;
        "accrualAdjustmentMultiplier()": FunctionFragment;
        "accrualAdjustmentPeriodCount()": FunctionFragment;
        "accrualAdjustmentPeriodSeconds()": FunctionFragment;
        "accrualParameter()": FunctionFragment;
        "activateMigration()": FunctionFragment;
        "bLUSDToken()": FunctionFragment;
        "bammSPVault()": FunctionFragment;
        "baseRedemptionRate()": FunctionFragment;
        "bondNFT()": FunctionFragment;
        "calcAccruedBLUSD(uint256)": FunctionFragment;
        "calcBondBLUSDCap(uint256)": FunctionFragment;
        "calcRedemptionFeePercentage(uint256)": FunctionFragment;
        "calcSystemBackingRatio()": FunctionFragment;
        "calcTotalLUSDValue()": FunctionFragment;
        "calcTotalYearnCurveVaultShareValue()": FunctionFragment;
        "calcUpdatedAccrualParameter()": FunctionFragment;
        "chickenIn(uint256)": FunctionFragment;
        "chickenOut(uint256,uint256)": FunctionFragment;
        "countChickenIn()": FunctionFragment;
        "countChickenOut()": FunctionFragment;
        "createBond(uint256)": FunctionFragment;
        "createBondWithPermit(address,uint256,uint256,uint8,bytes32,bytes32)": FunctionFragment;
        "curveBasePool()": FunctionFragment;
        "curveDepositLUSD3CRVExchangeRateThreshold()": FunctionFragment;
        "curveLiquidityGauge()": FunctionFragment;
        "curvePool()": FunctionFragment;
        "curveWithdrawal3CRVLUSDExchangeRateThreshold()": FunctionFragment;
        "deploymentTimestamp()": FunctionFragment;
        "firstChickenInTime()": FunctionFragment;
        "getAcquiredLUSDInCurve()": FunctionFragment;
        "getAcquiredLUSDInSP()": FunctionFragment;
        "getBAMMLUSDDebt()": FunctionFragment;
        "getBondData(uint256)": FunctionFragment;
        "getLUSDInBAMMSPVault()": FunctionFragment;
        "getLUSDToAcquire(uint256)": FunctionFragment;
        "getOpenBondCount()": FunctionFragment;
        "getOwnedLUSDInCurve()": FunctionFragment;
        "getOwnedLUSDInSP()": FunctionFragment;
        "getPendingLUSD()": FunctionFragment;
        "getPermanentLUSD()": FunctionFragment;
        "getTotalAcquiredLUSD()": FunctionFragment;
        "getTotalLUSDInCurve()": FunctionFragment;
        "getTreasury()": FunctionFragment;
        "lastRedemptionTime()": FunctionFragment;
        "lastShifterCountdownStartTime()": FunctionFragment;
        "lusdToken()": FunctionFragment;
        "migration()": FunctionFragment;
        "minimumAccrualParameter()": FunctionFragment;
        "redeem(uint256,uint256)": FunctionFragment;
        "sendFeeShare(uint256)": FunctionFragment;
        "shiftLUSDFromCurveToSP(uint256)": FunctionFragment;
        "shiftLUSDFromSPToCurve(uint256)": FunctionFragment;
        "startShifterCountdown()": FunctionFragment;
        "targetAverageAgeSeconds()": FunctionFragment;
        "totalWeightedStartTimes()": FunctionFragment;
        "yTokensHeldByCBM()": FunctionFragment;
        "yearnCurveVault()": FunctionFragment;
        "yearnGovernanceAddress()": FunctionFragment;
        "yearnRegistry()": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "BETA" | "BOOTSTRAP_PERIOD_CHICKEN_IN" | "BOOTSTRAP_PERIOD_REDEEM" | "BOOTSTRAP_PERIOD_SHIFT" | "CHICKEN_IN_AMM_FEE" | "DECIMAL_PRECISION" | "INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL" | "MINUTE_DECAY_FACTOR" | "MIN_BLUSD_SUPPLY" | "MIN_BOND_AMOUNT" | "NFT_RANDOMNESS_DIVISOR" | "SECONDS_IN_ONE_MINUTE" | "SHIFTER_DELAY" | "SHIFTER_WINDOW" | "_calcSystemBackingRatioFromBAMMValue" | "accrualAdjustmentMultiplier" | "accrualAdjustmentPeriodCount" | "accrualAdjustmentPeriodSeconds" | "accrualParameter" | "activateMigration" | "bLUSDToken" | "bammSPVault" | "baseRedemptionRate" | "bondNFT" | "calcAccruedBLUSD" | "calcBondBLUSDCap" | "calcRedemptionFeePercentage" | "calcSystemBackingRatio" | "calcTotalLUSDValue" | "calcTotalYearnCurveVaultShareValue" | "calcUpdatedAccrualParameter" | "chickenIn" | "chickenOut" | "countChickenIn" | "countChickenOut" | "createBond" | "createBondWithPermit" | "curveBasePool" | "curveDepositLUSD3CRVExchangeRateThreshold" | "curveLiquidityGauge" | "curvePool" | "curveWithdrawal3CRVLUSDExchangeRateThreshold" | "deploymentTimestamp" | "firstChickenInTime" | "getAcquiredLUSDInCurve" | "getAcquiredLUSDInSP" | "getBAMMLUSDDebt" | "getBondData" | "getLUSDInBAMMSPVault" | "getLUSDToAcquire" | "getOpenBondCount" | "getOwnedLUSDInCurve" | "getOwnedLUSDInSP" | "getPendingLUSD" | "getPermanentLUSD" | "getTotalAcquiredLUSD" | "getTotalLUSDInCurve" | "getTreasury" | "lastRedemptionTime" | "lastShifterCountdownStartTime" | "lusdToken" | "migration" | "minimumAccrualParameter" | "redeem" | "sendFeeShare" | "shiftLUSDFromCurveToSP" | "shiftLUSDFromSPToCurve" | "startShifterCountdown" | "targetAverageAgeSeconds" | "totalWeightedStartTimes" | "yTokensHeldByCBM" | "yearnCurveVault" | "yearnGovernanceAddress" | "yearnRegistry"): FunctionFragment;
    encodeFunctionData(functionFragment: "BETA", values?: undefined): string;
    encodeFunctionData(functionFragment: "BOOTSTRAP_PERIOD_CHICKEN_IN", values?: undefined): string;
    encodeFunctionData(functionFragment: "BOOTSTRAP_PERIOD_REDEEM", values?: undefined): string;
    encodeFunctionData(functionFragment: "BOOTSTRAP_PERIOD_SHIFT", values?: undefined): string;
    encodeFunctionData(functionFragment: "CHICKEN_IN_AMM_FEE", values?: undefined): string;
    encodeFunctionData(functionFragment: "DECIMAL_PRECISION", values?: undefined): string;
    encodeFunctionData(functionFragment: "INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL", values?: undefined): string;
    encodeFunctionData(functionFragment: "MINUTE_DECAY_FACTOR", values?: undefined): string;
    encodeFunctionData(functionFragment: "MIN_BLUSD_SUPPLY", values?: undefined): string;
    encodeFunctionData(functionFragment: "MIN_BOND_AMOUNT", values?: undefined): string;
    encodeFunctionData(functionFragment: "NFT_RANDOMNESS_DIVISOR", values?: undefined): string;
    encodeFunctionData(functionFragment: "SECONDS_IN_ONE_MINUTE", values?: undefined): string;
    encodeFunctionData(functionFragment: "SHIFTER_DELAY", values?: undefined): string;
    encodeFunctionData(functionFragment: "SHIFTER_WINDOW", values?: undefined): string;
    encodeFunctionData(functionFragment: "_calcSystemBackingRatioFromBAMMValue", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "accrualAdjustmentMultiplier", values?: undefined): string;
    encodeFunctionData(functionFragment: "accrualAdjustmentPeriodCount", values?: undefined): string;
    encodeFunctionData(functionFragment: "accrualAdjustmentPeriodSeconds", values?: undefined): string;
    encodeFunctionData(functionFragment: "accrualParameter", values?: undefined): string;
    encodeFunctionData(functionFragment: "activateMigration", values?: undefined): string;
    encodeFunctionData(functionFragment: "bLUSDToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "bammSPVault", values?: undefined): string;
    encodeFunctionData(functionFragment: "baseRedemptionRate", values?: undefined): string;
    encodeFunctionData(functionFragment: "bondNFT", values?: undefined): string;
    encodeFunctionData(functionFragment: "calcAccruedBLUSD", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "calcBondBLUSDCap", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "calcRedemptionFeePercentage", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "calcSystemBackingRatio", values?: undefined): string;
    encodeFunctionData(functionFragment: "calcTotalLUSDValue", values?: undefined): string;
    encodeFunctionData(functionFragment: "calcTotalYearnCurveVaultShareValue", values?: undefined): string;
    encodeFunctionData(functionFragment: "calcUpdatedAccrualParameter", values?: undefined): string;
    encodeFunctionData(functionFragment: "chickenIn", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "chickenOut", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "countChickenIn", values?: undefined): string;
    encodeFunctionData(functionFragment: "countChickenOut", values?: undefined): string;
    encodeFunctionData(functionFragment: "createBond", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "createBondWithPermit", values: [
        string,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BytesLike,
        BytesLike
    ]): string;
    encodeFunctionData(functionFragment: "curveBasePool", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveDepositLUSD3CRVExchangeRateThreshold", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveLiquidityGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "curvePool", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveWithdrawal3CRVLUSDExchangeRateThreshold", values?: undefined): string;
    encodeFunctionData(functionFragment: "deploymentTimestamp", values?: undefined): string;
    encodeFunctionData(functionFragment: "firstChickenInTime", values?: undefined): string;
    encodeFunctionData(functionFragment: "getAcquiredLUSDInCurve", values?: undefined): string;
    encodeFunctionData(functionFragment: "getAcquiredLUSDInSP", values?: undefined): string;
    encodeFunctionData(functionFragment: "getBAMMLUSDDebt", values?: undefined): string;
    encodeFunctionData(functionFragment: "getBondData", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getLUSDInBAMMSPVault", values?: undefined): string;
    encodeFunctionData(functionFragment: "getLUSDToAcquire", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getOpenBondCount", values?: undefined): string;
    encodeFunctionData(functionFragment: "getOwnedLUSDInCurve", values?: undefined): string;
    encodeFunctionData(functionFragment: "getOwnedLUSDInSP", values?: undefined): string;
    encodeFunctionData(functionFragment: "getPendingLUSD", values?: undefined): string;
    encodeFunctionData(functionFragment: "getPermanentLUSD", values?: undefined): string;
    encodeFunctionData(functionFragment: "getTotalAcquiredLUSD", values?: undefined): string;
    encodeFunctionData(functionFragment: "getTotalLUSDInCurve", values?: undefined): string;
    encodeFunctionData(functionFragment: "getTreasury", values?: undefined): string;
    encodeFunctionData(functionFragment: "lastRedemptionTime", values?: undefined): string;
    encodeFunctionData(functionFragment: "lastShifterCountdownStartTime", values?: undefined): string;
    encodeFunctionData(functionFragment: "lusdToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "migration", values?: undefined): string;
    encodeFunctionData(functionFragment: "minimumAccrualParameter", values?: undefined): string;
    encodeFunctionData(functionFragment: "redeem", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "sendFeeShare", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "shiftLUSDFromCurveToSP", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "shiftLUSDFromSPToCurve", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "startShifterCountdown", values?: undefined): string;
    encodeFunctionData(functionFragment: "targetAverageAgeSeconds", values?: undefined): string;
    encodeFunctionData(functionFragment: "totalWeightedStartTimes", values?: undefined): string;
    encodeFunctionData(functionFragment: "yTokensHeldByCBM", values?: undefined): string;
    encodeFunctionData(functionFragment: "yearnCurveVault", values?: undefined): string;
    encodeFunctionData(functionFragment: "yearnGovernanceAddress", values?: undefined): string;
    encodeFunctionData(functionFragment: "yearnRegistry", values?: undefined): string;
    decodeFunctionResult(functionFragment: "BETA", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "BOOTSTRAP_PERIOD_CHICKEN_IN", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "BOOTSTRAP_PERIOD_REDEEM", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "BOOTSTRAP_PERIOD_SHIFT", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "CHICKEN_IN_AMM_FEE", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "DECIMAL_PRECISION", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "MINUTE_DECAY_FACTOR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "MIN_BLUSD_SUPPLY", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "MIN_BOND_AMOUNT", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "NFT_RANDOMNESS_DIVISOR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "SECONDS_IN_ONE_MINUTE", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "SHIFTER_DELAY", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "SHIFTER_WINDOW", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "_calcSystemBackingRatioFromBAMMValue", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "accrualAdjustmentMultiplier", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "accrualAdjustmentPeriodCount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "accrualAdjustmentPeriodSeconds", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "accrualParameter", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "activateMigration", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bLUSDToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bammSPVault", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "baseRedemptionRate", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bondNFT", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcAccruedBLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcBondBLUSDCap", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcRedemptionFeePercentage", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcSystemBackingRatio", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcTotalLUSDValue", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcTotalYearnCurveVaultShareValue", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calcUpdatedAccrualParameter", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "chickenIn", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "chickenOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "countChickenIn", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "countChickenOut", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "createBond", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "createBondWithPermit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveBasePool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveDepositLUSD3CRVExchangeRateThreshold", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveLiquidityGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curvePool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveWithdrawal3CRVLUSDExchangeRateThreshold", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "deploymentTimestamp", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "firstChickenInTime", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getAcquiredLUSDInCurve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getAcquiredLUSDInSP", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBAMMLUSDDebt", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondData", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getLUSDInBAMMSPVault", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getLUSDToAcquire", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getOpenBondCount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getOwnedLUSDInCurve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getOwnedLUSDInSP", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getPendingLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getPermanentLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalAcquiredLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTotalLUSDInCurve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getTreasury", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lastRedemptionTime", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lastShifterCountdownStartTime", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lusdToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "migration", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "minimumAccrualParameter", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "redeem", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "sendFeeShare", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "shiftLUSDFromCurveToSP", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "shiftLUSDFromSPToCurve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "startShifterCountdown", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "targetAverageAgeSeconds", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "totalWeightedStartTimes", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "yTokensHeldByCBM", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "yearnCurveVault", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "yearnGovernanceAddress", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "yearnRegistry", data: BytesLike): Result;
    events: {
        "AccrualParameterUpdated(uint256)": EventFragment;
        "BLUSDRedeemed(address,uint256,uint256,uint256,uint256,uint256)": EventFragment;
        "BaseRedemptionRateUpdated(uint256)": EventFragment;
        "BondCancelled(address,uint256,uint256,uint256,uint256,uint80)": EventFragment;
        "BondClaimed(address,uint256,uint256,uint256,uint256,uint256,bool,uint80)": EventFragment;
        "BondCreated(address,uint256,uint256,uint80)": EventFragment;
        "LastRedemptionTimeUpdated(uint256)": EventFragment;
        "MigrationTriggered(uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "AccrualParameterUpdated"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BLUSDRedeemed"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BaseRedemptionRateUpdated"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BondCancelled"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BondClaimed"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BondCreated"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "LastRedemptionTimeUpdated"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "MigrationTriggered"): EventFragment;
}
export interface AccrualParameterUpdatedEventObject {
    accrualParameter: BigNumber;
}
export declare type AccrualParameterUpdatedEvent = TypedEvent<[
    BigNumber
], AccrualParameterUpdatedEventObject>;
export declare type AccrualParameterUpdatedEventFilter = TypedEventFilter<AccrualParameterUpdatedEvent>;
export interface BLUSDRedeemedEventObject {
    redeemer: string;
    bLusdAmount: BigNumber;
    minLusdAmount: BigNumber;
    lusdAmount: BigNumber;
    yTokens: BigNumber;
    redemptionFee: BigNumber;
}
export declare type BLUSDRedeemedEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], BLUSDRedeemedEventObject>;
export declare type BLUSDRedeemedEventFilter = TypedEventFilter<BLUSDRedeemedEvent>;
export interface BaseRedemptionRateUpdatedEventObject {
    _baseRedemptionRate: BigNumber;
}
export declare type BaseRedemptionRateUpdatedEvent = TypedEvent<[
    BigNumber
], BaseRedemptionRateUpdatedEventObject>;
export declare type BaseRedemptionRateUpdatedEventFilter = TypedEventFilter<BaseRedemptionRateUpdatedEvent>;
export interface BondCancelledEventObject {
    bonder: string;
    bondId: BigNumber;
    principalLusdAmount: BigNumber;
    minLusdAmount: BigNumber;
    withdrawnLusdAmount: BigNumber;
    bondFinalHalfDna: BigNumber;
}
export declare type BondCancelledEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], BondCancelledEventObject>;
export declare type BondCancelledEventFilter = TypedEventFilter<BondCancelledEvent>;
export interface BondClaimedEventObject {
    bonder: string;
    bondId: BigNumber;
    lusdAmount: BigNumber;
    bLusdAmount: BigNumber;
    lusdSurplus: BigNumber;
    chickenInFeeAmount: BigNumber;
    migration: boolean;
    bondFinalHalfDna: BigNumber;
}
export declare type BondClaimedEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    boolean,
    BigNumber
], BondClaimedEventObject>;
export declare type BondClaimedEventFilter = TypedEventFilter<BondClaimedEvent>;
export interface BondCreatedEventObject {
    bonder: string;
    bondId: BigNumber;
    amount: BigNumber;
    bondInitialHalfDna: BigNumber;
}
export declare type BondCreatedEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber
], BondCreatedEventObject>;
export declare type BondCreatedEventFilter = TypedEventFilter<BondCreatedEvent>;
export interface LastRedemptionTimeUpdatedEventObject {
    _lastRedemptionFeeOpTime: BigNumber;
}
export declare type LastRedemptionTimeUpdatedEvent = TypedEvent<[
    BigNumber
], LastRedemptionTimeUpdatedEventObject>;
export declare type LastRedemptionTimeUpdatedEventFilter = TypedEventFilter<LastRedemptionTimeUpdatedEvent>;
export interface MigrationTriggeredEventObject {
    previousPermanentLUSD: BigNumber;
}
export declare type MigrationTriggeredEvent = TypedEvent<[
    BigNumber
], MigrationTriggeredEventObject>;
export declare type MigrationTriggeredEventFilter = TypedEventFilter<MigrationTriggeredEvent>;
export interface ChickenBondManager extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: ChickenBondManagerInterface;
    queryFilter<TEvent extends TypedEvent>(event: TypedEventFilter<TEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TEvent>>;
    listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>;
    listeners(eventName?: string): Array<Listener>;
    removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this;
    removeAllListeners(eventName?: string): this;
    off: OnEvent<this>;
    on: OnEvent<this>;
    once: OnEvent<this>;
    removeListener: OnEvent<this>;
    functions: {
        BETA(overrides?: CallOverrides): Promise<[BigNumber]>;
        BOOTSTRAP_PERIOD_CHICKEN_IN(overrides?: CallOverrides): Promise<[BigNumber]>;
        BOOTSTRAP_PERIOD_REDEEM(overrides?: CallOverrides): Promise<[BigNumber]>;
        BOOTSTRAP_PERIOD_SHIFT(overrides?: CallOverrides): Promise<[BigNumber]>;
        CHICKEN_IN_AMM_FEE(overrides?: CallOverrides): Promise<[BigNumber]>;
        DECIMAL_PRECISION(overrides?: CallOverrides): Promise<[BigNumber]>;
        INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL(overrides?: CallOverrides): Promise<[BigNumber]>;
        MINUTE_DECAY_FACTOR(overrides?: CallOverrides): Promise<[BigNumber]>;
        MIN_BLUSD_SUPPLY(overrides?: CallOverrides): Promise<[BigNumber]>;
        MIN_BOND_AMOUNT(overrides?: CallOverrides): Promise<[BigNumber]>;
        NFT_RANDOMNESS_DIVISOR(overrides?: CallOverrides): Promise<[BigNumber]>;
        SECONDS_IN_ONE_MINUTE(overrides?: CallOverrides): Promise<[BigNumber]>;
        SHIFTER_DELAY(overrides?: CallOverrides): Promise<[BigNumber]>;
        SHIFTER_WINDOW(overrides?: CallOverrides): Promise<[BigNumber]>;
        _calcSystemBackingRatioFromBAMMValue(_bammLUSDValue: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        accrualAdjustmentMultiplier(overrides?: CallOverrides): Promise<[BigNumber]>;
        accrualAdjustmentPeriodCount(overrides?: CallOverrides): Promise<[BigNumber]>;
        accrualAdjustmentPeriodSeconds(overrides?: CallOverrides): Promise<[BigNumber]>;
        accrualParameter(overrides?: CallOverrides): Promise<[BigNumber]>;
        activateMigration(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        bLUSDToken(overrides?: CallOverrides): Promise<[string]>;
        bammSPVault(overrides?: CallOverrides): Promise<[string]>;
        baseRedemptionRate(overrides?: CallOverrides): Promise<[BigNumber]>;
        bondNFT(overrides?: CallOverrides): Promise<[string]>;
        calcAccruedBLUSD(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        calcBondBLUSDCap(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        calcRedemptionFeePercentage(_fractionOfBLUSDToRedeem: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        calcSystemBackingRatio(overrides?: CallOverrides): Promise<[BigNumber]>;
        calcTotalLUSDValue(overrides?: CallOverrides): Promise<[BigNumber]>;
        calcTotalYearnCurveVaultShareValue(overrides?: CallOverrides): Promise<[BigNumber]>;
        calcUpdatedAccrualParameter(overrides?: CallOverrides): Promise<[BigNumber]>;
        chickenIn(_bondID: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        chickenOut(_bondID: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        countChickenIn(overrides?: CallOverrides): Promise<[BigNumber]>;
        countChickenOut(overrides?: CallOverrides): Promise<[BigNumber]>;
        createBond(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        createBondWithPermit(owner: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        curveBasePool(overrides?: CallOverrides): Promise<[string]>;
        curveDepositLUSD3CRVExchangeRateThreshold(overrides?: CallOverrides): Promise<[BigNumber]>;
        curveLiquidityGauge(overrides?: CallOverrides): Promise<[string]>;
        curvePool(overrides?: CallOverrides): Promise<[string]>;
        curveWithdrawal3CRVLUSDExchangeRateThreshold(overrides?: CallOverrides): Promise<[BigNumber]>;
        deploymentTimestamp(overrides?: CallOverrides): Promise<[BigNumber]>;
        firstChickenInTime(overrides?: CallOverrides): Promise<[BigNumber]>;
        getAcquiredLUSDInCurve(overrides?: CallOverrides): Promise<[BigNumber]>;
        getAcquiredLUSDInSP(overrides?: CallOverrides): Promise<[BigNumber]>;
        getBAMMLUSDDebt(overrides?: CallOverrides): Promise<[BigNumber]>;
        getBondData(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            BigNumber,
            BigNumber,
            number
        ] & {
            lusdAmount: BigNumber;
            claimedBLUSD: BigNumber;
            startTime: BigNumber;
            endTime: BigNumber;
            status: number;
        }>;
        getLUSDInBAMMSPVault(overrides?: CallOverrides): Promise<[BigNumber]>;
        getLUSDToAcquire(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        getOpenBondCount(overrides?: CallOverrides): Promise<[BigNumber] & {
            openBondCount: BigNumber;
        }>;
        getOwnedLUSDInCurve(overrides?: CallOverrides): Promise<[BigNumber]>;
        getOwnedLUSDInSP(overrides?: CallOverrides): Promise<[BigNumber]>;
        getPendingLUSD(overrides?: CallOverrides): Promise<[BigNumber]>;
        getPermanentLUSD(overrides?: CallOverrides): Promise<[BigNumber]>;
        getTotalAcquiredLUSD(overrides?: CallOverrides): Promise<[BigNumber]>;
        getTotalLUSDInCurve(overrides?: CallOverrides): Promise<[BigNumber]>;
        getTreasury(overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            BigNumber
        ] & {
            _pendingLUSD: BigNumber;
            _totalAcquiredLUSD: BigNumber;
            _permanentLUSD: BigNumber;
        }>;
        lastRedemptionTime(overrides?: CallOverrides): Promise<[BigNumber]>;
        lastShifterCountdownStartTime(overrides?: CallOverrides): Promise<[BigNumber]>;
        lusdToken(overrides?: CallOverrides): Promise<[string]>;
        migration(overrides?: CallOverrides): Promise<[boolean]>;
        minimumAccrualParameter(overrides?: CallOverrides): Promise<[BigNumber]>;
        redeem(_bLUSDToRedeem: BigNumberish, _minLUSDFromBAMMSPVault: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        sendFeeShare(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        shiftLUSDFromCurveToSP(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        shiftLUSDFromSPToCurve(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        startShifterCountdown(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        targetAverageAgeSeconds(overrides?: CallOverrides): Promise<[BigNumber]>;
        totalWeightedStartTimes(overrides?: CallOverrides): Promise<[BigNumber]>;
        yTokensHeldByCBM(overrides?: CallOverrides): Promise<[BigNumber]>;
        yearnCurveVault(overrides?: CallOverrides): Promise<[string]>;
        yearnGovernanceAddress(overrides?: CallOverrides): Promise<[string]>;
        yearnRegistry(overrides?: CallOverrides): Promise<[string]>;
    };
    BETA(overrides?: CallOverrides): Promise<BigNumber>;
    BOOTSTRAP_PERIOD_CHICKEN_IN(overrides?: CallOverrides): Promise<BigNumber>;
    BOOTSTRAP_PERIOD_REDEEM(overrides?: CallOverrides): Promise<BigNumber>;
    BOOTSTRAP_PERIOD_SHIFT(overrides?: CallOverrides): Promise<BigNumber>;
    CHICKEN_IN_AMM_FEE(overrides?: CallOverrides): Promise<BigNumber>;
    DECIMAL_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
    INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL(overrides?: CallOverrides): Promise<BigNumber>;
    MINUTE_DECAY_FACTOR(overrides?: CallOverrides): Promise<BigNumber>;
    MIN_BLUSD_SUPPLY(overrides?: CallOverrides): Promise<BigNumber>;
    MIN_BOND_AMOUNT(overrides?: CallOverrides): Promise<BigNumber>;
    NFT_RANDOMNESS_DIVISOR(overrides?: CallOverrides): Promise<BigNumber>;
    SECONDS_IN_ONE_MINUTE(overrides?: CallOverrides): Promise<BigNumber>;
    SHIFTER_DELAY(overrides?: CallOverrides): Promise<BigNumber>;
    SHIFTER_WINDOW(overrides?: CallOverrides): Promise<BigNumber>;
    _calcSystemBackingRatioFromBAMMValue(_bammLUSDValue: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    accrualAdjustmentMultiplier(overrides?: CallOverrides): Promise<BigNumber>;
    accrualAdjustmentPeriodCount(overrides?: CallOverrides): Promise<BigNumber>;
    accrualAdjustmentPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
    accrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
    activateMigration(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    bLUSDToken(overrides?: CallOverrides): Promise<string>;
    bammSPVault(overrides?: CallOverrides): Promise<string>;
    baseRedemptionRate(overrides?: CallOverrides): Promise<BigNumber>;
    bondNFT(overrides?: CallOverrides): Promise<string>;
    calcAccruedBLUSD(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    calcBondBLUSDCap(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    calcRedemptionFeePercentage(_fractionOfBLUSDToRedeem: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    calcSystemBackingRatio(overrides?: CallOverrides): Promise<BigNumber>;
    calcTotalLUSDValue(overrides?: CallOverrides): Promise<BigNumber>;
    calcTotalYearnCurveVaultShareValue(overrides?: CallOverrides): Promise<BigNumber>;
    calcUpdatedAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
    chickenIn(_bondID: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    chickenOut(_bondID: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    countChickenIn(overrides?: CallOverrides): Promise<BigNumber>;
    countChickenOut(overrides?: CallOverrides): Promise<BigNumber>;
    createBond(_lusdAmount: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    createBondWithPermit(owner: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    curveBasePool(overrides?: CallOverrides): Promise<string>;
    curveDepositLUSD3CRVExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
    curveLiquidityGauge(overrides?: CallOverrides): Promise<string>;
    curvePool(overrides?: CallOverrides): Promise<string>;
    curveWithdrawal3CRVLUSDExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
    deploymentTimestamp(overrides?: CallOverrides): Promise<BigNumber>;
    firstChickenInTime(overrides?: CallOverrides): Promise<BigNumber>;
    getAcquiredLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
    getAcquiredLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
    getBAMMLUSDDebt(overrides?: CallOverrides): Promise<BigNumber>;
    getBondData(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber,
        number
    ] & {
        lusdAmount: BigNumber;
        claimedBLUSD: BigNumber;
        startTime: BigNumber;
        endTime: BigNumber;
        status: number;
    }>;
    getLUSDInBAMMSPVault(overrides?: CallOverrides): Promise<BigNumber>;
    getLUSDToAcquire(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getOpenBondCount(overrides?: CallOverrides): Promise<BigNumber>;
    getOwnedLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
    getOwnedLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
    getPendingLUSD(overrides?: CallOverrides): Promise<BigNumber>;
    getPermanentLUSD(overrides?: CallOverrides): Promise<BigNumber>;
    getTotalAcquiredLUSD(overrides?: CallOverrides): Promise<BigNumber>;
    getTotalLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
    getTreasury(overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber,
        BigNumber
    ] & {
        _pendingLUSD: BigNumber;
        _totalAcquiredLUSD: BigNumber;
        _permanentLUSD: BigNumber;
    }>;
    lastRedemptionTime(overrides?: CallOverrides): Promise<BigNumber>;
    lastShifterCountdownStartTime(overrides?: CallOverrides): Promise<BigNumber>;
    lusdToken(overrides?: CallOverrides): Promise<string>;
    migration(overrides?: CallOverrides): Promise<boolean>;
    minimumAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
    redeem(_bLUSDToRedeem: BigNumberish, _minLUSDFromBAMMSPVault: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    sendFeeShare(_lusdAmount: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    shiftLUSDFromCurveToSP(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    shiftLUSDFromSPToCurve(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    startShifterCountdown(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    targetAverageAgeSeconds(overrides?: CallOverrides): Promise<BigNumber>;
    totalWeightedStartTimes(overrides?: CallOverrides): Promise<BigNumber>;
    yTokensHeldByCBM(overrides?: CallOverrides): Promise<BigNumber>;
    yearnCurveVault(overrides?: CallOverrides): Promise<string>;
    yearnGovernanceAddress(overrides?: CallOverrides): Promise<string>;
    yearnRegistry(overrides?: CallOverrides): Promise<string>;
    callStatic: {
        BETA(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_CHICKEN_IN(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_REDEEM(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_SHIFT(overrides?: CallOverrides): Promise<BigNumber>;
        CHICKEN_IN_AMM_FEE(overrides?: CallOverrides): Promise<BigNumber>;
        DECIMAL_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
        INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL(overrides?: CallOverrides): Promise<BigNumber>;
        MINUTE_DECAY_FACTOR(overrides?: CallOverrides): Promise<BigNumber>;
        MIN_BLUSD_SUPPLY(overrides?: CallOverrides): Promise<BigNumber>;
        MIN_BOND_AMOUNT(overrides?: CallOverrides): Promise<BigNumber>;
        NFT_RANDOMNESS_DIVISOR(overrides?: CallOverrides): Promise<BigNumber>;
        SECONDS_IN_ONE_MINUTE(overrides?: CallOverrides): Promise<BigNumber>;
        SHIFTER_DELAY(overrides?: CallOverrides): Promise<BigNumber>;
        SHIFTER_WINDOW(overrides?: CallOverrides): Promise<BigNumber>;
        _calcSystemBackingRatioFromBAMMValue(_bammLUSDValue: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentMultiplier(overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentPeriodCount(overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        accrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        activateMigration(overrides?: CallOverrides): Promise<void>;
        bLUSDToken(overrides?: CallOverrides): Promise<string>;
        bammSPVault(overrides?: CallOverrides): Promise<string>;
        baseRedemptionRate(overrides?: CallOverrides): Promise<BigNumber>;
        bondNFT(overrides?: CallOverrides): Promise<string>;
        calcAccruedBLUSD(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcBondBLUSDCap(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcRedemptionFeePercentage(_fractionOfBLUSDToRedeem: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcSystemBackingRatio(overrides?: CallOverrides): Promise<BigNumber>;
        calcTotalLUSDValue(overrides?: CallOverrides): Promise<BigNumber>;
        calcTotalYearnCurveVaultShareValue(overrides?: CallOverrides): Promise<BigNumber>;
        calcUpdatedAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        chickenIn(_bondID: BigNumberish, overrides?: CallOverrides): Promise<void>;
        chickenOut(_bondID: BigNumberish, _minLUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
        countChickenIn(overrides?: CallOverrides): Promise<BigNumber>;
        countChickenOut(overrides?: CallOverrides): Promise<BigNumber>;
        createBond(_lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        createBondWithPermit(owner: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, overrides?: CallOverrides): Promise<BigNumber>;
        curveBasePool(overrides?: CallOverrides): Promise<string>;
        curveDepositLUSD3CRVExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
        curveLiquidityGauge(overrides?: CallOverrides): Promise<string>;
        curvePool(overrides?: CallOverrides): Promise<string>;
        curveWithdrawal3CRVLUSDExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
        deploymentTimestamp(overrides?: CallOverrides): Promise<BigNumber>;
        firstChickenInTime(overrides?: CallOverrides): Promise<BigNumber>;
        getAcquiredLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getAcquiredLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
        getBAMMLUSDDebt(overrides?: CallOverrides): Promise<BigNumber>;
        getBondData(_bondID: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            BigNumber,
            BigNumber,
            number
        ] & {
            lusdAmount: BigNumber;
            claimedBLUSD: BigNumber;
            startTime: BigNumber;
            endTime: BigNumber;
            status: number;
        }>;
        getLUSDInBAMMSPVault(overrides?: CallOverrides): Promise<BigNumber>;
        getLUSDToAcquire(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getOpenBondCount(overrides?: CallOverrides): Promise<BigNumber>;
        getOwnedLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getOwnedLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
        getPendingLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getPermanentLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getTotalAcquiredLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getTotalLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getTreasury(overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            BigNumber
        ] & {
            _pendingLUSD: BigNumber;
            _totalAcquiredLUSD: BigNumber;
            _permanentLUSD: BigNumber;
        }>;
        lastRedemptionTime(overrides?: CallOverrides): Promise<BigNumber>;
        lastShifterCountdownStartTime(overrides?: CallOverrides): Promise<BigNumber>;
        lusdToken(overrides?: CallOverrides): Promise<string>;
        migration(overrides?: CallOverrides): Promise<boolean>;
        minimumAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        redeem(_bLUSDToRedeem: BigNumberish, _minLUSDFromBAMMSPVault: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber, BigNumber]>;
        sendFeeShare(_lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<void>;
        shiftLUSDFromCurveToSP(_maxLUSDToShift: BigNumberish, overrides?: CallOverrides): Promise<void>;
        shiftLUSDFromSPToCurve(_maxLUSDToShift: BigNumberish, overrides?: CallOverrides): Promise<void>;
        startShifterCountdown(overrides?: CallOverrides): Promise<void>;
        targetAverageAgeSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        totalWeightedStartTimes(overrides?: CallOverrides): Promise<BigNumber>;
        yTokensHeldByCBM(overrides?: CallOverrides): Promise<BigNumber>;
        yearnCurveVault(overrides?: CallOverrides): Promise<string>;
        yearnGovernanceAddress(overrides?: CallOverrides): Promise<string>;
        yearnRegistry(overrides?: CallOverrides): Promise<string>;
    };
    filters: {
        "AccrualParameterUpdated(uint256)"(accrualParameter?: null): AccrualParameterUpdatedEventFilter;
        AccrualParameterUpdated(accrualParameter?: null): AccrualParameterUpdatedEventFilter;
        "BLUSDRedeemed(address,uint256,uint256,uint256,uint256,uint256)"(redeemer?: string | null, bLusdAmount?: null, minLusdAmount?: null, lusdAmount?: null, yTokens?: null, redemptionFee?: null): BLUSDRedeemedEventFilter;
        BLUSDRedeemed(redeemer?: string | null, bLusdAmount?: null, minLusdAmount?: null, lusdAmount?: null, yTokens?: null, redemptionFee?: null): BLUSDRedeemedEventFilter;
        "BaseRedemptionRateUpdated(uint256)"(_baseRedemptionRate?: null): BaseRedemptionRateUpdatedEventFilter;
        BaseRedemptionRateUpdated(_baseRedemptionRate?: null): BaseRedemptionRateUpdatedEventFilter;
        "BondCancelled(address,uint256,uint256,uint256,uint256,uint80)"(bonder?: string | null, bondId?: null, principalLusdAmount?: null, minLusdAmount?: null, withdrawnLusdAmount?: null, bondFinalHalfDna?: null): BondCancelledEventFilter;
        BondCancelled(bonder?: string | null, bondId?: null, principalLusdAmount?: null, minLusdAmount?: null, withdrawnLusdAmount?: null, bondFinalHalfDna?: null): BondCancelledEventFilter;
        "BondClaimed(address,uint256,uint256,uint256,uint256,uint256,bool,uint80)"(bonder?: string | null, bondId?: null, lusdAmount?: null, bLusdAmount?: null, lusdSurplus?: null, chickenInFeeAmount?: null, migration?: null, bondFinalHalfDna?: null): BondClaimedEventFilter;
        BondClaimed(bonder?: string | null, bondId?: null, lusdAmount?: null, bLusdAmount?: null, lusdSurplus?: null, chickenInFeeAmount?: null, migration?: null, bondFinalHalfDna?: null): BondClaimedEventFilter;
        "BondCreated(address,uint256,uint256,uint80)"(bonder?: string | null, bondId?: null, amount?: null, bondInitialHalfDna?: null): BondCreatedEventFilter;
        BondCreated(bonder?: string | null, bondId?: null, amount?: null, bondInitialHalfDna?: null): BondCreatedEventFilter;
        "LastRedemptionTimeUpdated(uint256)"(_lastRedemptionFeeOpTime?: null): LastRedemptionTimeUpdatedEventFilter;
        LastRedemptionTimeUpdated(_lastRedemptionFeeOpTime?: null): LastRedemptionTimeUpdatedEventFilter;
        "MigrationTriggered(uint256)"(previousPermanentLUSD?: null): MigrationTriggeredEventFilter;
        MigrationTriggered(previousPermanentLUSD?: null): MigrationTriggeredEventFilter;
    };
    estimateGas: {
        BETA(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_CHICKEN_IN(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_REDEEM(overrides?: CallOverrides): Promise<BigNumber>;
        BOOTSTRAP_PERIOD_SHIFT(overrides?: CallOverrides): Promise<BigNumber>;
        CHICKEN_IN_AMM_FEE(overrides?: CallOverrides): Promise<BigNumber>;
        DECIMAL_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
        INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL(overrides?: CallOverrides): Promise<BigNumber>;
        MINUTE_DECAY_FACTOR(overrides?: CallOverrides): Promise<BigNumber>;
        MIN_BLUSD_SUPPLY(overrides?: CallOverrides): Promise<BigNumber>;
        MIN_BOND_AMOUNT(overrides?: CallOverrides): Promise<BigNumber>;
        NFT_RANDOMNESS_DIVISOR(overrides?: CallOverrides): Promise<BigNumber>;
        SECONDS_IN_ONE_MINUTE(overrides?: CallOverrides): Promise<BigNumber>;
        SHIFTER_DELAY(overrides?: CallOverrides): Promise<BigNumber>;
        SHIFTER_WINDOW(overrides?: CallOverrides): Promise<BigNumber>;
        _calcSystemBackingRatioFromBAMMValue(_bammLUSDValue: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentMultiplier(overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentPeriodCount(overrides?: CallOverrides): Promise<BigNumber>;
        accrualAdjustmentPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        accrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        activateMigration(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        bLUSDToken(overrides?: CallOverrides): Promise<BigNumber>;
        bammSPVault(overrides?: CallOverrides): Promise<BigNumber>;
        baseRedemptionRate(overrides?: CallOverrides): Promise<BigNumber>;
        bondNFT(overrides?: CallOverrides): Promise<BigNumber>;
        calcAccruedBLUSD(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcBondBLUSDCap(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcRedemptionFeePercentage(_fractionOfBLUSDToRedeem: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        calcSystemBackingRatio(overrides?: CallOverrides): Promise<BigNumber>;
        calcTotalLUSDValue(overrides?: CallOverrides): Promise<BigNumber>;
        calcTotalYearnCurveVaultShareValue(overrides?: CallOverrides): Promise<BigNumber>;
        calcUpdatedAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        chickenIn(_bondID: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        chickenOut(_bondID: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        countChickenIn(overrides?: CallOverrides): Promise<BigNumber>;
        countChickenOut(overrides?: CallOverrides): Promise<BigNumber>;
        createBond(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        createBondWithPermit(owner: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        curveBasePool(overrides?: CallOverrides): Promise<BigNumber>;
        curveDepositLUSD3CRVExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
        curveLiquidityGauge(overrides?: CallOverrides): Promise<BigNumber>;
        curvePool(overrides?: CallOverrides): Promise<BigNumber>;
        curveWithdrawal3CRVLUSDExchangeRateThreshold(overrides?: CallOverrides): Promise<BigNumber>;
        deploymentTimestamp(overrides?: CallOverrides): Promise<BigNumber>;
        firstChickenInTime(overrides?: CallOverrides): Promise<BigNumber>;
        getAcquiredLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getAcquiredLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
        getBAMMLUSDDebt(overrides?: CallOverrides): Promise<BigNumber>;
        getBondData(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getLUSDInBAMMSPVault(overrides?: CallOverrides): Promise<BigNumber>;
        getLUSDToAcquire(_bondID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getOpenBondCount(overrides?: CallOverrides): Promise<BigNumber>;
        getOwnedLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getOwnedLUSDInSP(overrides?: CallOverrides): Promise<BigNumber>;
        getPendingLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getPermanentLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getTotalAcquiredLUSD(overrides?: CallOverrides): Promise<BigNumber>;
        getTotalLUSDInCurve(overrides?: CallOverrides): Promise<BigNumber>;
        getTreasury(overrides?: CallOverrides): Promise<BigNumber>;
        lastRedemptionTime(overrides?: CallOverrides): Promise<BigNumber>;
        lastShifterCountdownStartTime(overrides?: CallOverrides): Promise<BigNumber>;
        lusdToken(overrides?: CallOverrides): Promise<BigNumber>;
        migration(overrides?: CallOverrides): Promise<BigNumber>;
        minimumAccrualParameter(overrides?: CallOverrides): Promise<BigNumber>;
        redeem(_bLUSDToRedeem: BigNumberish, _minLUSDFromBAMMSPVault: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        sendFeeShare(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        shiftLUSDFromCurveToSP(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        shiftLUSDFromSPToCurve(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        startShifterCountdown(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        targetAverageAgeSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        totalWeightedStartTimes(overrides?: CallOverrides): Promise<BigNumber>;
        yTokensHeldByCBM(overrides?: CallOverrides): Promise<BigNumber>;
        yearnCurveVault(overrides?: CallOverrides): Promise<BigNumber>;
        yearnGovernanceAddress(overrides?: CallOverrides): Promise<BigNumber>;
        yearnRegistry(overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        BETA(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        BOOTSTRAP_PERIOD_CHICKEN_IN(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        BOOTSTRAP_PERIOD_REDEEM(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        BOOTSTRAP_PERIOD_SHIFT(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        CHICKEN_IN_AMM_FEE(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        DECIMAL_PRECISION(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        INDEX_OF_LUSD_TOKEN_IN_CURVE_POOL(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        MINUTE_DECAY_FACTOR(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        MIN_BLUSD_SUPPLY(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        MIN_BOND_AMOUNT(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        NFT_RANDOMNESS_DIVISOR(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        SECONDS_IN_ONE_MINUTE(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        SHIFTER_DELAY(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        SHIFTER_WINDOW(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        _calcSystemBackingRatioFromBAMMValue(_bammLUSDValue: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        accrualAdjustmentMultiplier(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        accrualAdjustmentPeriodCount(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        accrualAdjustmentPeriodSeconds(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        accrualParameter(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        activateMigration(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        bLUSDToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bammSPVault(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        baseRedemptionRate(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bondNFT(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcAccruedBLUSD(_bondID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcBondBLUSDCap(_bondID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcRedemptionFeePercentage(_fractionOfBLUSDToRedeem: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcSystemBackingRatio(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcTotalLUSDValue(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcTotalYearnCurveVaultShareValue(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calcUpdatedAccrualParameter(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        chickenIn(_bondID: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        chickenOut(_bondID: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        countChickenIn(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        countChickenOut(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        createBond(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        createBondWithPermit(owner: string, amount: BigNumberish, deadline: BigNumberish, v: BigNumberish, r: BytesLike, s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        curveBasePool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveDepositLUSD3CRVExchangeRateThreshold(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveLiquidityGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curvePool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveWithdrawal3CRVLUSDExchangeRateThreshold(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        deploymentTimestamp(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        firstChickenInTime(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getAcquiredLUSDInCurve(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getAcquiredLUSDInSP(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBAMMLUSDDebt(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondData(_bondID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getLUSDInBAMMSPVault(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getLUSDToAcquire(_bondID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getOpenBondCount(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getOwnedLUSDInCurve(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getOwnedLUSDInSP(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getPendingLUSD(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getPermanentLUSD(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getTotalAcquiredLUSD(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getTotalLUSDInCurve(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getTreasury(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lastRedemptionTime(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lastShifterCountdownStartTime(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lusdToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        migration(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        minimumAccrualParameter(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        redeem(_bLUSDToRedeem: BigNumberish, _minLUSDFromBAMMSPVault: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        sendFeeShare(_lusdAmount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        shiftLUSDFromCurveToSP(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        shiftLUSDFromSPToCurve(_maxLUSDToShift: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        startShifterCountdown(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        targetAverageAgeSeconds(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        totalWeightedStartTimes(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        yTokensHeldByCBM(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        yearnCurveVault(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        yearnGovernanceAddress(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        yearnRegistry(overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
