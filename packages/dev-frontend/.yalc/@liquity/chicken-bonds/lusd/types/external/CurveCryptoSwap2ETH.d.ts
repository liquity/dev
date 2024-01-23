import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PayableOverrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface CurveCryptoSwap2ETHInterface extends utils.Interface {
    functions: {
        "token()": FunctionFragment;
        "coins(uint256)": FunctionFragment;
        "A()": FunctionFragment;
        "gamma()": FunctionFragment;
        "fee()": FunctionFragment;
        "get_virtual_price()": FunctionFragment;
        "price_oracle()": FunctionFragment;
        "exchange(uint256,uint256,uint256,uint256)": FunctionFragment;
        "exchange(uint256,uint256,uint256,uint256,bool)": FunctionFragment;
        "exchange(uint256,uint256,uint256,uint256,bool,address)": FunctionFragment;
        "exchange_underlying(uint256,uint256,uint256,uint256)": FunctionFragment;
        "exchange_underlying(uint256,uint256,uint256,uint256,address)": FunctionFragment;
        "exchange_extended(uint256,uint256,uint256,uint256,bool,address,address,bytes)": FunctionFragment;
        "get_dy(uint256,uint256,uint256)": FunctionFragment;
        "add_liquidity(uint256[2],uint256)": FunctionFragment;
        "add_liquidity(uint256[2],uint256,bool)": FunctionFragment;
        "add_liquidity(uint256[2],uint256,bool,address)": FunctionFragment;
        "remove_liquidity(uint256,uint256[2])": FunctionFragment;
        "remove_liquidity(uint256,uint256[2],bool)": FunctionFragment;
        "remove_liquidity(uint256,uint256[2],bool,address)": FunctionFragment;
        "calc_token_amount(uint256[2])": FunctionFragment;
        "calc_withdraw_one_coin(uint256,uint256)": FunctionFragment;
        "remove_liquidity_one_coin(uint256,uint256,uint256)": FunctionFragment;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool)": FunctionFragment;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)": FunctionFragment;
        "claim_admin_fees()": FunctionFragment;
        "ramp_A_gamma(uint256,uint256,uint256)": FunctionFragment;
        "stop_ramp_A_gamma()": FunctionFragment;
        "commit_new_parameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256)": FunctionFragment;
        "apply_new_parameters()": FunctionFragment;
        "revert_new_parameters()": FunctionFragment;
        "commit_transfer_ownership(address)": FunctionFragment;
        "apply_transfer_ownership()": FunctionFragment;
        "revert_transfer_ownership()": FunctionFragment;
        "kill_me()": FunctionFragment;
        "unkill_me()": FunctionFragment;
        "set_admin_fee_receiver(address)": FunctionFragment;
        "lp_price()": FunctionFragment;
        "price_scale()": FunctionFragment;
        "last_prices()": FunctionFragment;
        "last_prices_timestamp()": FunctionFragment;
        "initial_A_gamma()": FunctionFragment;
        "future_A_gamma()": FunctionFragment;
        "initial_A_gamma_time()": FunctionFragment;
        "future_A_gamma_time()": FunctionFragment;
        "allowed_extra_profit()": FunctionFragment;
        "future_allowed_extra_profit()": FunctionFragment;
        "fee_gamma()": FunctionFragment;
        "future_fee_gamma()": FunctionFragment;
        "adjustment_step()": FunctionFragment;
        "future_adjustment_step()": FunctionFragment;
        "ma_half_time()": FunctionFragment;
        "future_ma_half_time()": FunctionFragment;
        "mid_fee()": FunctionFragment;
        "out_fee()": FunctionFragment;
        "admin_fee()": FunctionFragment;
        "future_mid_fee()": FunctionFragment;
        "future_out_fee()": FunctionFragment;
        "future_admin_fee()": FunctionFragment;
        "balances(uint256)": FunctionFragment;
        "D()": FunctionFragment;
        "owner()": FunctionFragment;
        "future_owner()": FunctionFragment;
        "xcp_profit()": FunctionFragment;
        "xcp_profit_a()": FunctionFragment;
        "virtual_price()": FunctionFragment;
        "is_killed()": FunctionFragment;
        "kill_deadline()": FunctionFragment;
        "transfer_ownership_deadline()": FunctionFragment;
        "admin_actions_deadline()": FunctionFragment;
        "admin_fee_receiver()": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "token" | "coins" | "A" | "gamma" | "fee" | "get_virtual_price" | "price_oracle" | "exchange(uint256,uint256,uint256,uint256)" | "exchange(uint256,uint256,uint256,uint256,bool)" | "exchange(uint256,uint256,uint256,uint256,bool,address)" | "exchange_underlying(uint256,uint256,uint256,uint256)" | "exchange_underlying(uint256,uint256,uint256,uint256,address)" | "exchange_extended" | "get_dy" | "add_liquidity(uint256[2],uint256)" | "add_liquidity(uint256[2],uint256,bool)" | "add_liquidity(uint256[2],uint256,bool,address)" | "remove_liquidity(uint256,uint256[2])" | "remove_liquidity(uint256,uint256[2],bool)" | "remove_liquidity(uint256,uint256[2],bool,address)" | "calc_token_amount" | "calc_withdraw_one_coin" | "remove_liquidity_one_coin(uint256,uint256,uint256)" | "remove_liquidity_one_coin(uint256,uint256,uint256,bool)" | "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)" | "claim_admin_fees" | "ramp_A_gamma" | "stop_ramp_A_gamma" | "commit_new_parameters" | "apply_new_parameters" | "revert_new_parameters" | "commit_transfer_ownership" | "apply_transfer_ownership" | "revert_transfer_ownership" | "kill_me" | "unkill_me" | "set_admin_fee_receiver" | "lp_price" | "price_scale" | "last_prices" | "last_prices_timestamp" | "initial_A_gamma" | "future_A_gamma" | "initial_A_gamma_time" | "future_A_gamma_time" | "allowed_extra_profit" | "future_allowed_extra_profit" | "fee_gamma" | "future_fee_gamma" | "adjustment_step" | "future_adjustment_step" | "ma_half_time" | "future_ma_half_time" | "mid_fee" | "out_fee" | "admin_fee" | "future_mid_fee" | "future_out_fee" | "future_admin_fee" | "balances" | "D" | "owner" | "future_owner" | "xcp_profit" | "xcp_profit_a" | "virtual_price" | "is_killed" | "kill_deadline" | "transfer_ownership_deadline" | "admin_actions_deadline" | "admin_fee_receiver"): FunctionFragment;
    encodeFunctionData(functionFragment: "token", values?: undefined): string;
    encodeFunctionData(functionFragment: "coins", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "A", values?: undefined): string;
    encodeFunctionData(functionFragment: "gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "get_virtual_price", values?: undefined): string;
    encodeFunctionData(functionFragment: "price_oracle", values?: undefined): string;
    encodeFunctionData(functionFragment: "exchange(uint256,uint256,uint256,uint256)", values: [BigNumberish, BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "exchange(uint256,uint256,uint256,uint256,bool)", values: [BigNumberish, BigNumberish, BigNumberish, BigNumberish, boolean]): string;
    encodeFunctionData(functionFragment: "exchange(uint256,uint256,uint256,uint256,bool,address)", values: [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        boolean,
        string
    ]): string;
    encodeFunctionData(functionFragment: "exchange_underlying(uint256,uint256,uint256,uint256)", values: [BigNumberish, BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "exchange_underlying(uint256,uint256,uint256,uint256,address)", values: [BigNumberish, BigNumberish, BigNumberish, BigNumberish, string]): string;
    encodeFunctionData(functionFragment: "exchange_extended", values: [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        boolean,
        string,
        string,
        BytesLike
    ]): string;
    encodeFunctionData(functionFragment: "get_dy", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "add_liquidity(uint256[2],uint256)", values: [[BigNumberish, BigNumberish], BigNumberish]): string;
    encodeFunctionData(functionFragment: "add_liquidity(uint256[2],uint256,bool)", values: [[BigNumberish, BigNumberish], BigNumberish, boolean]): string;
    encodeFunctionData(functionFragment: "add_liquidity(uint256[2],uint256,bool,address)", values: [[BigNumberish, BigNumberish], BigNumberish, boolean, string]): string;
    encodeFunctionData(functionFragment: "remove_liquidity(uint256,uint256[2])", values: [BigNumberish, [BigNumberish, BigNumberish]]): string;
    encodeFunctionData(functionFragment: "remove_liquidity(uint256,uint256[2],bool)", values: [BigNumberish, [BigNumberish, BigNumberish], boolean]): string;
    encodeFunctionData(functionFragment: "remove_liquidity(uint256,uint256[2],bool,address)", values: [BigNumberish, [BigNumberish, BigNumberish], boolean, string]): string;
    encodeFunctionData(functionFragment: "calc_token_amount", values: [[BigNumberish, BigNumberish]]): string;
    encodeFunctionData(functionFragment: "calc_withdraw_one_coin", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256)", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256,bool)", values: [BigNumberish, BigNumberish, BigNumberish, boolean]): string;
    encodeFunctionData(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)", values: [BigNumberish, BigNumberish, BigNumberish, boolean, string]): string;
    encodeFunctionData(functionFragment: "claim_admin_fees", values?: undefined): string;
    encodeFunctionData(functionFragment: "ramp_A_gamma", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "stop_ramp_A_gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "commit_new_parameters", values: [
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BigNumberish
    ]): string;
    encodeFunctionData(functionFragment: "apply_new_parameters", values?: undefined): string;
    encodeFunctionData(functionFragment: "revert_new_parameters", values?: undefined): string;
    encodeFunctionData(functionFragment: "commit_transfer_ownership", values: [string]): string;
    encodeFunctionData(functionFragment: "apply_transfer_ownership", values?: undefined): string;
    encodeFunctionData(functionFragment: "revert_transfer_ownership", values?: undefined): string;
    encodeFunctionData(functionFragment: "kill_me", values?: undefined): string;
    encodeFunctionData(functionFragment: "unkill_me", values?: undefined): string;
    encodeFunctionData(functionFragment: "set_admin_fee_receiver", values: [string]): string;
    encodeFunctionData(functionFragment: "lp_price", values?: undefined): string;
    encodeFunctionData(functionFragment: "price_scale", values?: undefined): string;
    encodeFunctionData(functionFragment: "last_prices", values?: undefined): string;
    encodeFunctionData(functionFragment: "last_prices_timestamp", values?: undefined): string;
    encodeFunctionData(functionFragment: "initial_A_gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_A_gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "initial_A_gamma_time", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_A_gamma_time", values?: undefined): string;
    encodeFunctionData(functionFragment: "allowed_extra_profit", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_allowed_extra_profit", values?: undefined): string;
    encodeFunctionData(functionFragment: "fee_gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_fee_gamma", values?: undefined): string;
    encodeFunctionData(functionFragment: "adjustment_step", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_adjustment_step", values?: undefined): string;
    encodeFunctionData(functionFragment: "ma_half_time", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_ma_half_time", values?: undefined): string;
    encodeFunctionData(functionFragment: "mid_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "out_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "admin_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_mid_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_out_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_admin_fee", values?: undefined): string;
    encodeFunctionData(functionFragment: "balances", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "D", values?: undefined): string;
    encodeFunctionData(functionFragment: "owner", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_owner", values?: undefined): string;
    encodeFunctionData(functionFragment: "xcp_profit", values?: undefined): string;
    encodeFunctionData(functionFragment: "xcp_profit_a", values?: undefined): string;
    encodeFunctionData(functionFragment: "virtual_price", values?: undefined): string;
    encodeFunctionData(functionFragment: "is_killed", values?: undefined): string;
    encodeFunctionData(functionFragment: "kill_deadline", values?: undefined): string;
    encodeFunctionData(functionFragment: "transfer_ownership_deadline", values?: undefined): string;
    encodeFunctionData(functionFragment: "admin_actions_deadline", values?: undefined): string;
    encodeFunctionData(functionFragment: "admin_fee_receiver", values?: undefined): string;
    decodeFunctionResult(functionFragment: "token", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "coins", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "A", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_virtual_price", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "price_oracle", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange(uint256,uint256,uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange(uint256,uint256,uint256,uint256,bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange(uint256,uint256,uint256,uint256,bool,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_underlying(uint256,uint256,uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_underlying(uint256,uint256,uint256,uint256,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_extended", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_dy", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "add_liquidity(uint256[2],uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "add_liquidity(uint256[2],uint256,bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "add_liquidity(uint256[2],uint256,bool,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity(uint256,uint256[2])", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity(uint256,uint256[2],bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity(uint256,uint256[2],bool,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calc_token_amount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "calc_withdraw_one_coin", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256,bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claim_admin_fees", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "ramp_A_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "stop_ramp_A_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "commit_new_parameters", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "apply_new_parameters", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "revert_new_parameters", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "commit_transfer_ownership", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "apply_transfer_ownership", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "revert_transfer_ownership", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "kill_me", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "unkill_me", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_admin_fee_receiver", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lp_price", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "price_scale", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "last_prices", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "last_prices_timestamp", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "initial_A_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_A_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "initial_A_gamma_time", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_A_gamma_time", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "allowed_extra_profit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_allowed_extra_profit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "fee_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_fee_gamma", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "adjustment_step", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_adjustment_step", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "ma_half_time", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_ma_half_time", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "mid_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "out_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "admin_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_mid_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_out_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_admin_fee", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "balances", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "D", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_owner", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "xcp_profit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "xcp_profit_a", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "virtual_price", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "is_killed", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "kill_deadline", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transfer_ownership_deadline", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "admin_actions_deadline", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "admin_fee_receiver", data: BytesLike): Result;
    events: {
        "TokenExchange(address,uint256,uint256,uint256,uint256)": EventFragment;
        "AddLiquidity(address,uint256[2],uint256,uint256)": EventFragment;
        "RemoveLiquidity(address,uint256[2],uint256)": EventFragment;
        "RemoveLiquidityOne(address,uint256,uint256,uint256)": EventFragment;
        "CommitNewAdmin(uint256,address)": EventFragment;
        "NewAdmin(address)": EventFragment;
        "CommitNewParameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)": EventFragment;
        "NewParameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256)": EventFragment;
        "RampAgamma(uint256,uint256,uint256,uint256,uint256,uint256)": EventFragment;
        "StopRampA(uint256,uint256,uint256)": EventFragment;
        "ClaimAdminFee(address,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "TokenExchange"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "AddLiquidity"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "RemoveLiquidity"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "RemoveLiquidityOne"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "CommitNewAdmin"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "NewAdmin"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "CommitNewParameters"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "NewParameters"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "RampAgamma"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "StopRampA"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "ClaimAdminFee"): EventFragment;
}
export interface TokenExchangeEventObject {
    buyer: string;
    sold_id: BigNumber;
    tokens_sold: BigNumber;
    bought_id: BigNumber;
    tokens_bought: BigNumber;
}
export declare type TokenExchangeEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], TokenExchangeEventObject>;
export declare type TokenExchangeEventFilter = TypedEventFilter<TokenExchangeEvent>;
export interface AddLiquidityEventObject {
    provider: string;
    token_amounts: [BigNumber, BigNumber];
    fee: BigNumber;
    token_supply: BigNumber;
}
export declare type AddLiquidityEvent = TypedEvent<[
    string,
    [BigNumber, BigNumber],
    BigNumber,
    BigNumber
], AddLiquidityEventObject>;
export declare type AddLiquidityEventFilter = TypedEventFilter<AddLiquidityEvent>;
export interface RemoveLiquidityEventObject {
    provider: string;
    token_amounts: [BigNumber, BigNumber];
    token_supply: BigNumber;
}
export declare type RemoveLiquidityEvent = TypedEvent<[
    string,
    [BigNumber, BigNumber],
    BigNumber
], RemoveLiquidityEventObject>;
export declare type RemoveLiquidityEventFilter = TypedEventFilter<RemoveLiquidityEvent>;
export interface RemoveLiquidityOneEventObject {
    provider: string;
    token_amount: BigNumber;
    coin_index: BigNumber;
    coin_amount: BigNumber;
}
export declare type RemoveLiquidityOneEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber
], RemoveLiquidityOneEventObject>;
export declare type RemoveLiquidityOneEventFilter = TypedEventFilter<RemoveLiquidityOneEvent>;
export interface CommitNewAdminEventObject {
    deadline: BigNumber;
    admin: string;
}
export declare type CommitNewAdminEvent = TypedEvent<[
    BigNumber,
    string
], CommitNewAdminEventObject>;
export declare type CommitNewAdminEventFilter = TypedEventFilter<CommitNewAdminEvent>;
export interface NewAdminEventObject {
    admin: string;
}
export declare type NewAdminEvent = TypedEvent<[string], NewAdminEventObject>;
export declare type NewAdminEventFilter = TypedEventFilter<NewAdminEvent>;
export interface CommitNewParametersEventObject {
    deadline: BigNumber;
    admin_fee: BigNumber;
    mid_fee: BigNumber;
    out_fee: BigNumber;
    fee_gamma: BigNumber;
    allowed_extra_profit: BigNumber;
    adjustment_step: BigNumber;
    ma_half_time: BigNumber;
}
export declare type CommitNewParametersEvent = TypedEvent<[
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], CommitNewParametersEventObject>;
export declare type CommitNewParametersEventFilter = TypedEventFilter<CommitNewParametersEvent>;
export interface NewParametersEventObject {
    admin_fee: BigNumber;
    mid_fee: BigNumber;
    out_fee: BigNumber;
    fee_gamma: BigNumber;
    allowed_extra_profit: BigNumber;
    adjustment_step: BigNumber;
    ma_half_time: BigNumber;
}
export declare type NewParametersEvent = TypedEvent<[
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], NewParametersEventObject>;
export declare type NewParametersEventFilter = TypedEventFilter<NewParametersEvent>;
export interface RampAgammaEventObject {
    initial_A: BigNumber;
    future_A: BigNumber;
    initial_gamma: BigNumber;
    future_gamma: BigNumber;
    initial_time: BigNumber;
    future_time: BigNumber;
}
export declare type RampAgammaEvent = TypedEvent<[
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], RampAgammaEventObject>;
export declare type RampAgammaEventFilter = TypedEventFilter<RampAgammaEvent>;
export interface StopRampAEventObject {
    current_A: BigNumber;
    current_gamma: BigNumber;
    time: BigNumber;
}
export declare type StopRampAEvent = TypedEvent<[
    BigNumber,
    BigNumber,
    BigNumber
], StopRampAEventObject>;
export declare type StopRampAEventFilter = TypedEventFilter<StopRampAEvent>;
export interface ClaimAdminFeeEventObject {
    admin: string;
    tokens: BigNumber;
}
export declare type ClaimAdminFeeEvent = TypedEvent<[
    string,
    BigNumber
], ClaimAdminFeeEventObject>;
export declare type ClaimAdminFeeEventFilter = TypedEventFilter<ClaimAdminFeeEvent>;
export interface CurveCryptoSwap2ETH extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: CurveCryptoSwap2ETHInterface;
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
        token(overrides?: CallOverrides): Promise<[string]>;
        coins(i: BigNumberish, overrides?: CallOverrides): Promise<[string]>;
        A(overrides?: CallOverrides): Promise<[BigNumber]>;
        gamma(overrides?: CallOverrides): Promise<[BigNumber]>;
        fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        get_virtual_price(overrides?: CallOverrides): Promise<[BigNumber]>;
        price_oracle(overrides?: CallOverrides): Promise<[BigNumber]>;
        "exchange(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange(uint256,uint256,uint256,uint256,bool)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange(uint256,uint256,uint256,uint256,bool,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_underlying(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_underlying(uint256,uint256,uint256,uint256,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        exchange_extended(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, sender: string, receiver: string, cb: BytesLike, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        get_dy(i: BigNumberish, j: BigNumberish, dx: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        "add_liquidity(uint256[2],uint256)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "add_liquidity(uint256[2],uint256,bool)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "add_liquidity(uint256[2],uint256,bool,address)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "remove_liquidity(uint256,uint256[2])"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "remove_liquidity(uint256,uint256[2],bool)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "remove_liquidity(uint256,uint256[2],bool,address)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        calc_token_amount(amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<[BigNumber]>;
        calc_withdraw_one_coin(token_amount: BigNumberish, i: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        "remove_liquidity_one_coin(uint256,uint256,uint256)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        claim_admin_fees(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        ramp_A_gamma(future_A: BigNumberish, future_gamma: BigNumberish, future_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        stop_ramp_A_gamma(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        commit_new_parameters(_new_mid_fee: BigNumberish, _new_out_fee: BigNumberish, _new_admin_fee: BigNumberish, _new_fee_gamma: BigNumberish, _new_allowed_extra_profit: BigNumberish, _new_adjustment_step: BigNumberish, _new_ma_half_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        apply_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        revert_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        commit_transfer_ownership(_owner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        apply_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        revert_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        kill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        unkill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_admin_fee_receiver(_admin_fee_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        lp_price(overrides?: CallOverrides): Promise<[BigNumber]>;
        price_scale(overrides?: CallOverrides): Promise<[BigNumber]>;
        last_prices(overrides?: CallOverrides): Promise<[BigNumber]>;
        last_prices_timestamp(overrides?: CallOverrides): Promise<[BigNumber]>;
        initial_A_gamma(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_A_gamma(overrides?: CallOverrides): Promise<[BigNumber]>;
        initial_A_gamma_time(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_A_gamma_time(overrides?: CallOverrides): Promise<[BigNumber]>;
        allowed_extra_profit(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_allowed_extra_profit(overrides?: CallOverrides): Promise<[BigNumber]>;
        fee_gamma(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_fee_gamma(overrides?: CallOverrides): Promise<[BigNumber]>;
        adjustment_step(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_adjustment_step(overrides?: CallOverrides): Promise<[BigNumber]>;
        ma_half_time(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_ma_half_time(overrides?: CallOverrides): Promise<[BigNumber]>;
        mid_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        out_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        admin_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_mid_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_out_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_admin_fee(overrides?: CallOverrides): Promise<[BigNumber]>;
        balances(arg0: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        D(overrides?: CallOverrides): Promise<[BigNumber]>;
        owner(overrides?: CallOverrides): Promise<[string]>;
        future_owner(overrides?: CallOverrides): Promise<[string]>;
        xcp_profit(overrides?: CallOverrides): Promise<[BigNumber]>;
        xcp_profit_a(overrides?: CallOverrides): Promise<[BigNumber]>;
        virtual_price(overrides?: CallOverrides): Promise<[BigNumber]>;
        is_killed(overrides?: CallOverrides): Promise<[boolean]>;
        kill_deadline(overrides?: CallOverrides): Promise<[BigNumber]>;
        transfer_ownership_deadline(overrides?: CallOverrides): Promise<[BigNumber]>;
        admin_actions_deadline(overrides?: CallOverrides): Promise<[BigNumber]>;
        admin_fee_receiver(overrides?: CallOverrides): Promise<[string]>;
    };
    token(overrides?: CallOverrides): Promise<string>;
    coins(i: BigNumberish, overrides?: CallOverrides): Promise<string>;
    A(overrides?: CallOverrides): Promise<BigNumber>;
    gamma(overrides?: CallOverrides): Promise<BigNumber>;
    fee(overrides?: CallOverrides): Promise<BigNumber>;
    get_virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
    price_oracle(overrides?: CallOverrides): Promise<BigNumber>;
    "exchange(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange(uint256,uint256,uint256,uint256,bool)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange(uint256,uint256,uint256,uint256,bool,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_underlying(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_underlying(uint256,uint256,uint256,uint256,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    exchange_extended(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, sender: string, receiver: string, cb: BytesLike, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    get_dy(i: BigNumberish, j: BigNumberish, dx: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    "add_liquidity(uint256[2],uint256)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "add_liquidity(uint256[2],uint256,bool)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "add_liquidity(uint256[2],uint256,bool,address)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "remove_liquidity(uint256,uint256[2])"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "remove_liquidity(uint256,uint256[2],bool)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "remove_liquidity(uint256,uint256[2],bool,address)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, receiver: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    calc_token_amount(amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<BigNumber>;
    calc_withdraw_one_coin(token_amount: BigNumberish, i: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    "remove_liquidity_one_coin(uint256,uint256,uint256)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "remove_liquidity_one_coin(uint256,uint256,uint256,bool)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    claim_admin_fees(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    ramp_A_gamma(future_A: BigNumberish, future_gamma: BigNumberish, future_time: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    stop_ramp_A_gamma(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    commit_new_parameters(_new_mid_fee: BigNumberish, _new_out_fee: BigNumberish, _new_admin_fee: BigNumberish, _new_fee_gamma: BigNumberish, _new_allowed_extra_profit: BigNumberish, _new_adjustment_step: BigNumberish, _new_ma_half_time: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    apply_new_parameters(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    revert_new_parameters(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    commit_transfer_ownership(_owner: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    apply_transfer_ownership(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    revert_transfer_ownership(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    kill_me(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    unkill_me(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_admin_fee_receiver(_admin_fee_receiver: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    lp_price(overrides?: CallOverrides): Promise<BigNumber>;
    price_scale(overrides?: CallOverrides): Promise<BigNumber>;
    last_prices(overrides?: CallOverrides): Promise<BigNumber>;
    last_prices_timestamp(overrides?: CallOverrides): Promise<BigNumber>;
    initial_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
    future_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
    initial_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
    future_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
    allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
    future_allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
    fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
    future_fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
    adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
    future_adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
    ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
    future_ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
    mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
    out_fee(overrides?: CallOverrides): Promise<BigNumber>;
    admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
    future_mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
    future_out_fee(overrides?: CallOverrides): Promise<BigNumber>;
    future_admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
    balances(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    D(overrides?: CallOverrides): Promise<BigNumber>;
    owner(overrides?: CallOverrides): Promise<string>;
    future_owner(overrides?: CallOverrides): Promise<string>;
    xcp_profit(overrides?: CallOverrides): Promise<BigNumber>;
    xcp_profit_a(overrides?: CallOverrides): Promise<BigNumber>;
    virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
    is_killed(overrides?: CallOverrides): Promise<boolean>;
    kill_deadline(overrides?: CallOverrides): Promise<BigNumber>;
    transfer_ownership_deadline(overrides?: CallOverrides): Promise<BigNumber>;
    admin_actions_deadline(overrides?: CallOverrides): Promise<BigNumber>;
    admin_fee_receiver(overrides?: CallOverrides): Promise<string>;
    callStatic: {
        token(overrides?: CallOverrides): Promise<string>;
        coins(i: BigNumberish, overrides?: CallOverrides): Promise<string>;
        A(overrides?: CallOverrides): Promise<BigNumber>;
        gamma(overrides?: CallOverrides): Promise<BigNumber>;
        fee(overrides?: CallOverrides): Promise<BigNumber>;
        get_virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
        price_oracle(overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256,bool)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256,bool,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_underlying(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_underlying(uint256,uint256,uint256,uint256,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        exchange_extended(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, sender: string, receiver: string, cb: BytesLike, overrides?: CallOverrides): Promise<BigNumber>;
        get_dy(i: BigNumberish, j: BigNumberish, dx: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256,bool)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, overrides?: CallOverrides): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256,bool,address)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        "remove_liquidity(uint256,uint256[2])"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<void>;
        "remove_liquidity(uint256,uint256[2],bool)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, overrides?: CallOverrides): Promise<void>;
        "remove_liquidity(uint256,uint256[2],bool,address)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, receiver: string, overrides?: CallOverrides): Promise<void>;
        calc_token_amount(amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<BigNumber>;
        calc_withdraw_one_coin(token_amount: BigNumberish, i: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, overrides?: CallOverrides): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        claim_admin_fees(overrides?: CallOverrides): Promise<void>;
        ramp_A_gamma(future_A: BigNumberish, future_gamma: BigNumberish, future_time: BigNumberish, overrides?: CallOverrides): Promise<void>;
        stop_ramp_A_gamma(overrides?: CallOverrides): Promise<void>;
        commit_new_parameters(_new_mid_fee: BigNumberish, _new_out_fee: BigNumberish, _new_admin_fee: BigNumberish, _new_fee_gamma: BigNumberish, _new_allowed_extra_profit: BigNumberish, _new_adjustment_step: BigNumberish, _new_ma_half_time: BigNumberish, overrides?: CallOverrides): Promise<void>;
        apply_new_parameters(overrides?: CallOverrides): Promise<void>;
        revert_new_parameters(overrides?: CallOverrides): Promise<void>;
        commit_transfer_ownership(_owner: string, overrides?: CallOverrides): Promise<void>;
        apply_transfer_ownership(overrides?: CallOverrides): Promise<void>;
        revert_transfer_ownership(overrides?: CallOverrides): Promise<void>;
        kill_me(overrides?: CallOverrides): Promise<void>;
        unkill_me(overrides?: CallOverrides): Promise<void>;
        set_admin_fee_receiver(_admin_fee_receiver: string, overrides?: CallOverrides): Promise<void>;
        lp_price(overrides?: CallOverrides): Promise<BigNumber>;
        price_scale(overrides?: CallOverrides): Promise<BigNumber>;
        last_prices(overrides?: CallOverrides): Promise<BigNumber>;
        last_prices_timestamp(overrides?: CallOverrides): Promise<BigNumber>;
        initial_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        future_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        initial_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
        future_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
        allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
        future_allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
        fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        future_fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
        future_adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
        ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
        future_ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
        mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
        out_fee(overrides?: CallOverrides): Promise<BigNumber>;
        admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_out_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
        balances(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        D(overrides?: CallOverrides): Promise<BigNumber>;
        owner(overrides?: CallOverrides): Promise<string>;
        future_owner(overrides?: CallOverrides): Promise<string>;
        xcp_profit(overrides?: CallOverrides): Promise<BigNumber>;
        xcp_profit_a(overrides?: CallOverrides): Promise<BigNumber>;
        virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
        is_killed(overrides?: CallOverrides): Promise<boolean>;
        kill_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        transfer_ownership_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        admin_actions_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        admin_fee_receiver(overrides?: CallOverrides): Promise<string>;
    };
    filters: {
        "TokenExchange(address,uint256,uint256,uint256,uint256)"(buyer?: string | null, sold_id?: null, tokens_sold?: null, bought_id?: null, tokens_bought?: null): TokenExchangeEventFilter;
        TokenExchange(buyer?: string | null, sold_id?: null, tokens_sold?: null, bought_id?: null, tokens_bought?: null): TokenExchangeEventFilter;
        "AddLiquidity(address,uint256[2],uint256,uint256)"(provider?: string | null, token_amounts?: null, fee?: null, token_supply?: null): AddLiquidityEventFilter;
        AddLiquidity(provider?: string | null, token_amounts?: null, fee?: null, token_supply?: null): AddLiquidityEventFilter;
        "RemoveLiquidity(address,uint256[2],uint256)"(provider?: string | null, token_amounts?: null, token_supply?: null): RemoveLiquidityEventFilter;
        RemoveLiquidity(provider?: string | null, token_amounts?: null, token_supply?: null): RemoveLiquidityEventFilter;
        "RemoveLiquidityOne(address,uint256,uint256,uint256)"(provider?: string | null, token_amount?: null, coin_index?: null, coin_amount?: null): RemoveLiquidityOneEventFilter;
        RemoveLiquidityOne(provider?: string | null, token_amount?: null, coin_index?: null, coin_amount?: null): RemoveLiquidityOneEventFilter;
        "CommitNewAdmin(uint256,address)"(deadline?: BigNumberish | null, admin?: string | null): CommitNewAdminEventFilter;
        CommitNewAdmin(deadline?: BigNumberish | null, admin?: string | null): CommitNewAdminEventFilter;
        "NewAdmin(address)"(admin?: string | null): NewAdminEventFilter;
        NewAdmin(admin?: string | null): NewAdminEventFilter;
        "CommitNewParameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"(deadline?: BigNumberish | null, admin_fee?: null, mid_fee?: null, out_fee?: null, fee_gamma?: null, allowed_extra_profit?: null, adjustment_step?: null, ma_half_time?: null): CommitNewParametersEventFilter;
        CommitNewParameters(deadline?: BigNumberish | null, admin_fee?: null, mid_fee?: null, out_fee?: null, fee_gamma?: null, allowed_extra_profit?: null, adjustment_step?: null, ma_half_time?: null): CommitNewParametersEventFilter;
        "NewParameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256)"(admin_fee?: null, mid_fee?: null, out_fee?: null, fee_gamma?: null, allowed_extra_profit?: null, adjustment_step?: null, ma_half_time?: null): NewParametersEventFilter;
        NewParameters(admin_fee?: null, mid_fee?: null, out_fee?: null, fee_gamma?: null, allowed_extra_profit?: null, adjustment_step?: null, ma_half_time?: null): NewParametersEventFilter;
        "RampAgamma(uint256,uint256,uint256,uint256,uint256,uint256)"(initial_A?: null, future_A?: null, initial_gamma?: null, future_gamma?: null, initial_time?: null, future_time?: null): RampAgammaEventFilter;
        RampAgamma(initial_A?: null, future_A?: null, initial_gamma?: null, future_gamma?: null, initial_time?: null, future_time?: null): RampAgammaEventFilter;
        "StopRampA(uint256,uint256,uint256)"(current_A?: null, current_gamma?: null, time?: null): StopRampAEventFilter;
        StopRampA(current_A?: null, current_gamma?: null, time?: null): StopRampAEventFilter;
        "ClaimAdminFee(address,uint256)"(admin?: string | null, tokens?: null): ClaimAdminFeeEventFilter;
        ClaimAdminFee(admin?: string | null, tokens?: null): ClaimAdminFeeEventFilter;
    };
    estimateGas: {
        token(overrides?: CallOverrides): Promise<BigNumber>;
        coins(i: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        A(overrides?: CallOverrides): Promise<BigNumber>;
        gamma(overrides?: CallOverrides): Promise<BigNumber>;
        fee(overrides?: CallOverrides): Promise<BigNumber>;
        get_virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
        price_oracle(overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256,bool)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange(uint256,uint256,uint256,uint256,bool,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_underlying(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_underlying(uint256,uint256,uint256,uint256,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        exchange_extended(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, sender: string, receiver: string, cb: BytesLike, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        get_dy(i: BigNumberish, j: BigNumberish, dx: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256,bool)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "add_liquidity(uint256[2],uint256,bool,address)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "remove_liquidity(uint256,uint256[2])"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "remove_liquidity(uint256,uint256[2],bool)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "remove_liquidity(uint256,uint256[2],bool,address)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        calc_token_amount(amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<BigNumber>;
        calc_withdraw_one_coin(token_amount: BigNumberish, i: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        claim_admin_fees(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        ramp_A_gamma(future_A: BigNumberish, future_gamma: BigNumberish, future_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        stop_ramp_A_gamma(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        commit_new_parameters(_new_mid_fee: BigNumberish, _new_out_fee: BigNumberish, _new_admin_fee: BigNumberish, _new_fee_gamma: BigNumberish, _new_allowed_extra_profit: BigNumberish, _new_adjustment_step: BigNumberish, _new_ma_half_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        apply_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        revert_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        commit_transfer_ownership(_owner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        apply_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        revert_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        kill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        unkill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_admin_fee_receiver(_admin_fee_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        lp_price(overrides?: CallOverrides): Promise<BigNumber>;
        price_scale(overrides?: CallOverrides): Promise<BigNumber>;
        last_prices(overrides?: CallOverrides): Promise<BigNumber>;
        last_prices_timestamp(overrides?: CallOverrides): Promise<BigNumber>;
        initial_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        future_A_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        initial_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
        future_A_gamma_time(overrides?: CallOverrides): Promise<BigNumber>;
        allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
        future_allowed_extra_profit(overrides?: CallOverrides): Promise<BigNumber>;
        fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        future_fee_gamma(overrides?: CallOverrides): Promise<BigNumber>;
        adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
        future_adjustment_step(overrides?: CallOverrides): Promise<BigNumber>;
        ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
        future_ma_half_time(overrides?: CallOverrides): Promise<BigNumber>;
        mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
        out_fee(overrides?: CallOverrides): Promise<BigNumber>;
        admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_mid_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_out_fee(overrides?: CallOverrides): Promise<BigNumber>;
        future_admin_fee(overrides?: CallOverrides): Promise<BigNumber>;
        balances(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        D(overrides?: CallOverrides): Promise<BigNumber>;
        owner(overrides?: CallOverrides): Promise<BigNumber>;
        future_owner(overrides?: CallOverrides): Promise<BigNumber>;
        xcp_profit(overrides?: CallOverrides): Promise<BigNumber>;
        xcp_profit_a(overrides?: CallOverrides): Promise<BigNumber>;
        virtual_price(overrides?: CallOverrides): Promise<BigNumber>;
        is_killed(overrides?: CallOverrides): Promise<BigNumber>;
        kill_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        transfer_ownership_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        admin_actions_deadline(overrides?: CallOverrides): Promise<BigNumber>;
        admin_fee_receiver(overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        token(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        coins(i: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        A(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        gamma(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        get_virtual_price(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        price_oracle(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "exchange(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange(uint256,uint256,uint256,uint256,bool)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange(uint256,uint256,uint256,uint256,bool,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_underlying(uint256,uint256,uint256,uint256)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_underlying(uint256,uint256,uint256,uint256,address)"(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        exchange_extended(i: BigNumberish, j: BigNumberish, dx: BigNumberish, min_dy: BigNumberish, use_eth: boolean, sender: string, receiver: string, cb: BytesLike, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        get_dy(i: BigNumberish, j: BigNumberish, dx: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "add_liquidity(uint256[2],uint256)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "add_liquidity(uint256[2],uint256,bool)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "add_liquidity(uint256[2],uint256,bool,address)"(amounts: [BigNumberish, BigNumberish], min_mint_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "remove_liquidity(uint256,uint256[2])"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "remove_liquidity(uint256,uint256[2],bool)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "remove_liquidity(uint256,uint256[2],bool,address)"(_amount: BigNumberish, min_amounts: [BigNumberish, BigNumberish], use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        calc_token_amount(amounts: [BigNumberish, BigNumberish], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        calc_withdraw_one_coin(token_amount: BigNumberish, i: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "remove_liquidity_one_coin(uint256,uint256,uint256)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "remove_liquidity_one_coin(uint256,uint256,uint256,bool,address)"(token_amount: BigNumberish, i: BigNumberish, min_amount: BigNumberish, use_eth: boolean, receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        claim_admin_fees(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        ramp_A_gamma(future_A: BigNumberish, future_gamma: BigNumberish, future_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        stop_ramp_A_gamma(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        commit_new_parameters(_new_mid_fee: BigNumberish, _new_out_fee: BigNumberish, _new_admin_fee: BigNumberish, _new_fee_gamma: BigNumberish, _new_allowed_extra_profit: BigNumberish, _new_adjustment_step: BigNumberish, _new_ma_half_time: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        apply_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        revert_new_parameters(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        commit_transfer_ownership(_owner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        apply_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        revert_transfer_ownership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        kill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        unkill_me(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_admin_fee_receiver(_admin_fee_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        lp_price(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        price_scale(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        last_prices(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        last_prices_timestamp(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        initial_A_gamma(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_A_gamma(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        initial_A_gamma_time(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_A_gamma_time(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        allowed_extra_profit(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_allowed_extra_profit(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        fee_gamma(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_fee_gamma(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        adjustment_step(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_adjustment_step(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        ma_half_time(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_ma_half_time(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        mid_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        out_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        admin_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_mid_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_out_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_admin_fee(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        balances(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        D(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        xcp_profit(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        xcp_profit_a(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        virtual_price(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        is_killed(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        kill_deadline(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        transfer_ownership_deadline(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        admin_actions_deadline(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        admin_fee_receiver(overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
