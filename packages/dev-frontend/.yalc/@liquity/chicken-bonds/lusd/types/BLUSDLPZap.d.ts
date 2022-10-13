import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface BLUSDLPZapInterface extends utils.Interface {
    functions: {
        "addLiquidity(uint256,uint256,uint256)": FunctionFragment;
        "addLiquidityAndStake(uint256,uint256,uint256)": FunctionFragment;
        "bLUSDGauge()": FunctionFragment;
        "bLUSDLUSD3CRVLPToken()": FunctionFragment;
        "bLUSDLUSD3CRVPool()": FunctionFragment;
        "bLUSDToken()": FunctionFragment;
        "getMinLPTokens(uint256,uint256)": FunctionFragment;
        "getMinWithdrawBLUSD(uint256)": FunctionFragment;
        "getMinWithdrawBalanced(uint256)": FunctionFragment;
        "getMinWithdrawLUSD(uint256)": FunctionFragment;
        "lusd3CRVPool()": FunctionFragment;
        "lusdToken()": FunctionFragment;
        "removeLiquidityBLUSD(uint256,uint256)": FunctionFragment;
        "removeLiquidityBalanced(uint256,uint256,uint256)": FunctionFragment;
        "removeLiquidityLUSD(uint256,uint256)": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "addLiquidity" | "addLiquidityAndStake" | "bLUSDGauge" | "bLUSDLUSD3CRVLPToken" | "bLUSDLUSD3CRVPool" | "bLUSDToken" | "getMinLPTokens" | "getMinWithdrawBLUSD" | "getMinWithdrawBalanced" | "getMinWithdrawLUSD" | "lusd3CRVPool" | "lusdToken" | "removeLiquidityBLUSD" | "removeLiquidityBalanced" | "removeLiquidityLUSD"): FunctionFragment;
    encodeFunctionData(functionFragment: "addLiquidity", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "addLiquidityAndStake", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "bLUSDGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "bLUSDLUSD3CRVLPToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "bLUSDLUSD3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "bLUSDToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "getMinLPTokens", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawBLUSD", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawBalanced", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawLUSD", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "lusd3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "lusdToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "removeLiquidityBLUSD", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "removeLiquidityBalanced", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "removeLiquidityLUSD", values: [BigNumberish, BigNumberish]): string;
    decodeFunctionResult(functionFragment: "addLiquidity", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "addLiquidityAndStake", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bLUSDGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bLUSDLUSD3CRVLPToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bLUSDLUSD3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bLUSDToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinLPTokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawBLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lusd3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lusdToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityBLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityLUSD", data: BytesLike): Result;
    events: {
        "BLusdLiquidityAdded(address,uint256)": EventFragment;
        "BalancedLiquidityRemoved(address,uint256,uint256)": EventFragment;
        "SingleLiquidityRemoved(address,string,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "BLusdLiquidityAdded"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "BalancedLiquidityRemoved"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "SingleLiquidityRemoved"): EventFragment;
}
export interface BLusdLiquidityAddedEventObject {
    user: string;
    bLusdLpTokenAmountReceived: BigNumber;
}
export declare type BLusdLiquidityAddedEvent = TypedEvent<[
    string,
    BigNumber
], BLusdLiquidityAddedEventObject>;
export declare type BLusdLiquidityAddedEventFilter = TypedEventFilter<BLusdLiquidityAddedEvent>;
export interface BalancedLiquidityRemovedEventObject {
    user: string;
    bLusdAmountReceived: BigNumber;
    lusdAmountReceived: BigNumber;
}
export declare type BalancedLiquidityRemovedEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber
], BalancedLiquidityRemovedEventObject>;
export declare type BalancedLiquidityRemovedEventFilter = TypedEventFilter<BalancedLiquidityRemovedEvent>;
export interface SingleLiquidityRemovedEventObject {
    user: string;
    token: string;
    amountReceived: BigNumber;
}
export declare type SingleLiquidityRemovedEvent = TypedEvent<[
    string,
    string,
    BigNumber
], SingleLiquidityRemovedEventObject>;
export declare type SingleLiquidityRemovedEventFilter = TypedEventFilter<SingleLiquidityRemovedEvent>;
export interface BLUSDLPZap extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: BLUSDLPZapInterface;
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
        addLiquidity(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        addLiquidityAndStake(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        bLUSDGauge(overrides?: CallOverrides): Promise<[string]>;
        bLUSDLUSD3CRVLPToken(overrides?: CallOverrides): Promise<[string]>;
        bLUSDLUSD3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        bLUSDToken(overrides?: CallOverrides): Promise<[string]>;
        getMinLPTokens(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            bLUSDLUSD3CRVTokens: BigNumber;
        }>;
        getMinWithdrawBLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            bLUSDAmount: BigNumber;
        }>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bLUSDAmount: BigNumber;
            lusdAmount: BigNumber;
        }>;
        getMinWithdrawLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            lusdAmount: BigNumber;
        }>;
        lusd3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        lusdToken(overrides?: CallOverrides): Promise<[string]>;
        removeLiquidityBLUSD(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityLUSD(_lpAmount: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
    };
    addLiquidity(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    addLiquidityAndStake(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    bLUSDGauge(overrides?: CallOverrides): Promise<string>;
    bLUSDLUSD3CRVLPToken(overrides?: CallOverrides): Promise<string>;
    bLUSDLUSD3CRVPool(overrides?: CallOverrides): Promise<string>;
    bLUSDToken(overrides?: CallOverrides): Promise<string>;
    getMinLPTokens(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getMinWithdrawBLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber
    ] & {
        bLUSDAmount: BigNumber;
        lusdAmount: BigNumber;
    }>;
    getMinWithdrawLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    lusd3CRVPool(overrides?: CallOverrides): Promise<string>;
    lusdToken(overrides?: CallOverrides): Promise<string>;
    removeLiquidityBLUSD(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityBalanced(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityLUSD(_lpAmount: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    callStatic: {
        addLiquidity(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        addLiquidityAndStake(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        bLUSDGauge(overrides?: CallOverrides): Promise<string>;
        bLUSDLUSD3CRVLPToken(overrides?: CallOverrides): Promise<string>;
        bLUSDLUSD3CRVPool(overrides?: CallOverrides): Promise<string>;
        bLUSDToken(overrides?: CallOverrides): Promise<string>;
        getMinLPTokens(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bLUSDAmount: BigNumber;
            lusdAmount: BigNumber;
        }>;
        getMinWithdrawLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        lusd3CRVPool(overrides?: CallOverrides): Promise<string>;
        lusdToken(overrides?: CallOverrides): Promise<string>;
        removeLiquidityBLUSD(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, _minLUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
        removeLiquidityLUSD(_lpAmount: BigNumberish, _minLUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
    };
    filters: {
        "BLusdLiquidityAdded(address,uint256)"(user?: string | null, bLusdLpTokenAmountReceived?: null): BLusdLiquidityAddedEventFilter;
        BLusdLiquidityAdded(user?: string | null, bLusdLpTokenAmountReceived?: null): BLusdLiquidityAddedEventFilter;
        "BalancedLiquidityRemoved(address,uint256,uint256)"(user?: string | null, bLusdAmountReceived?: null, lusdAmountReceived?: null): BalancedLiquidityRemovedEventFilter;
        BalancedLiquidityRemoved(user?: string | null, bLusdAmountReceived?: null, lusdAmountReceived?: null): BalancedLiquidityRemovedEventFilter;
        "SingleLiquidityRemoved(address,string,uint256)"(user?: string | null, token?: null, amountReceived?: null): SingleLiquidityRemovedEventFilter;
        SingleLiquidityRemoved(user?: string | null, token?: null, amountReceived?: null): SingleLiquidityRemovedEventFilter;
    };
    estimateGas: {
        addLiquidity(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        addLiquidityAndStake(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        bLUSDGauge(overrides?: CallOverrides): Promise<BigNumber>;
        bLUSDLUSD3CRVLPToken(overrides?: CallOverrides): Promise<BigNumber>;
        bLUSDLUSD3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        bLUSDToken(overrides?: CallOverrides): Promise<BigNumber>;
        getMinLPTokens(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        lusd3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        lusdToken(overrides?: CallOverrides): Promise<BigNumber>;
        removeLiquidityBLUSD(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        removeLiquidityLUSD(_lpAmount: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
    };
    populateTransaction: {
        addLiquidity(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        addLiquidityAndStake(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        bLUSDGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bLUSDLUSD3CRVLPToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bLUSDLUSD3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bLUSDToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinLPTokens(_bLUSDAmount: BigNumberish, _lusdAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawBLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawLUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lusd3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lusdToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        removeLiquidityBLUSD(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBLUSD: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityLUSD(_lpAmount: BigNumberish, _minLUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
    };
}
