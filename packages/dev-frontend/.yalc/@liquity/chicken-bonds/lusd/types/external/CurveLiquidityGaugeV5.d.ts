import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface CurveLiquidityGaugeV5Interface extends utils.Interface {
    functions: {
        "deposit(uint256)": FunctionFragment;
        "deposit(uint256,address)": FunctionFragment;
        "deposit(uint256,address,bool)": FunctionFragment;
        "withdraw(uint256)": FunctionFragment;
        "withdraw(uint256,bool)": FunctionFragment;
        "claim_rewards()": FunctionFragment;
        "claim_rewards(address)": FunctionFragment;
        "claim_rewards(address,address)": FunctionFragment;
        "transferFrom(address,address,uint256)": FunctionFragment;
        "transfer(address,uint256)": FunctionFragment;
        "approve(address,uint256)": FunctionFragment;
        "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)": FunctionFragment;
        "increaseAllowance(address,uint256)": FunctionFragment;
        "decreaseAllowance(address,uint256)": FunctionFragment;
        "user_checkpoint(address)": FunctionFragment;
        "set_rewards_receiver(address)": FunctionFragment;
        "kick(address)": FunctionFragment;
        "deposit_reward_token(address,uint256)": FunctionFragment;
        "add_reward(address,address)": FunctionFragment;
        "set_reward_distributor(address,address)": FunctionFragment;
        "set_killed(bool)": FunctionFragment;
        "claimed_reward(address,address)": FunctionFragment;
        "claimable_reward(address,address)": FunctionFragment;
        "claimable_tokens(address)": FunctionFragment;
        "integrate_checkpoint()": FunctionFragment;
        "future_epoch_time()": FunctionFragment;
        "inflation_rate()": FunctionFragment;
        "decimals()": FunctionFragment;
        "version()": FunctionFragment;
        "initialize(address)": FunctionFragment;
        "balanceOf(address)": FunctionFragment;
        "totalSupply()": FunctionFragment;
        "allowance(address,address)": FunctionFragment;
        "name()": FunctionFragment;
        "symbol()": FunctionFragment;
        "DOMAIN_SEPARATOR()": FunctionFragment;
        "nonces(address)": FunctionFragment;
        "factory()": FunctionFragment;
        "lp_token()": FunctionFragment;
        "is_killed()": FunctionFragment;
        "reward_count()": FunctionFragment;
        "reward_data(address)": FunctionFragment;
        "rewards_receiver(address)": FunctionFragment;
        "reward_integral_for(address,address)": FunctionFragment;
        "working_balances(address)": FunctionFragment;
        "working_supply()": FunctionFragment;
        "integrate_inv_supply_of(address)": FunctionFragment;
        "integrate_checkpoint_of(address)": FunctionFragment;
        "integrate_fraction(address)": FunctionFragment;
        "period()": FunctionFragment;
        "reward_tokens(uint256)": FunctionFragment;
        "period_timestamp(uint256)": FunctionFragment;
        "integrate_inv_supply(uint256)": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "deposit(uint256)" | "deposit(uint256,address)" | "deposit(uint256,address,bool)" | "withdraw(uint256)" | "withdraw(uint256,bool)" | "claim_rewards()" | "claim_rewards(address)" | "claim_rewards(address,address)" | "transferFrom" | "transfer" | "approve" | "permit" | "increaseAllowance" | "decreaseAllowance" | "user_checkpoint" | "set_rewards_receiver" | "kick" | "deposit_reward_token" | "add_reward" | "set_reward_distributor" | "set_killed" | "claimed_reward" | "claimable_reward" | "claimable_tokens" | "integrate_checkpoint" | "future_epoch_time" | "inflation_rate" | "decimals" | "version" | "initialize" | "balanceOf" | "totalSupply" | "allowance" | "name" | "symbol" | "DOMAIN_SEPARATOR" | "nonces" | "factory" | "lp_token" | "is_killed" | "reward_count" | "reward_data" | "rewards_receiver" | "reward_integral_for" | "working_balances" | "working_supply" | "integrate_inv_supply_of" | "integrate_checkpoint_of" | "integrate_fraction" | "period" | "reward_tokens" | "period_timestamp" | "integrate_inv_supply"): FunctionFragment;
    encodeFunctionData(functionFragment: "deposit(uint256)", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "deposit(uint256,address)", values: [BigNumberish, string]): string;
    encodeFunctionData(functionFragment: "deposit(uint256,address,bool)", values: [BigNumberish, string, boolean]): string;
    encodeFunctionData(functionFragment: "withdraw(uint256)", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "withdraw(uint256,bool)", values: [BigNumberish, boolean]): string;
    encodeFunctionData(functionFragment: "claim_rewards()", values?: undefined): string;
    encodeFunctionData(functionFragment: "claim_rewards(address)", values: [string]): string;
    encodeFunctionData(functionFragment: "claim_rewards(address,address)", values: [string, string]): string;
    encodeFunctionData(functionFragment: "transferFrom", values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "transfer", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "approve", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "permit", values: [
        string,
        string,
        BigNumberish,
        BigNumberish,
        BigNumberish,
        BytesLike,
        BytesLike
    ]): string;
    encodeFunctionData(functionFragment: "increaseAllowance", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "decreaseAllowance", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "user_checkpoint", values: [string]): string;
    encodeFunctionData(functionFragment: "set_rewards_receiver", values: [string]): string;
    encodeFunctionData(functionFragment: "kick", values: [string]): string;
    encodeFunctionData(functionFragment: "deposit_reward_token", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "add_reward", values: [string, string]): string;
    encodeFunctionData(functionFragment: "set_reward_distributor", values: [string, string]): string;
    encodeFunctionData(functionFragment: "set_killed", values: [boolean]): string;
    encodeFunctionData(functionFragment: "claimed_reward", values: [string, string]): string;
    encodeFunctionData(functionFragment: "claimable_reward", values: [string, string]): string;
    encodeFunctionData(functionFragment: "claimable_tokens", values: [string]): string;
    encodeFunctionData(functionFragment: "integrate_checkpoint", values?: undefined): string;
    encodeFunctionData(functionFragment: "future_epoch_time", values?: undefined): string;
    encodeFunctionData(functionFragment: "inflation_rate", values?: undefined): string;
    encodeFunctionData(functionFragment: "decimals", values?: undefined): string;
    encodeFunctionData(functionFragment: "version", values?: undefined): string;
    encodeFunctionData(functionFragment: "initialize", values: [string]): string;
    encodeFunctionData(functionFragment: "balanceOf", values: [string]): string;
    encodeFunctionData(functionFragment: "totalSupply", values?: undefined): string;
    encodeFunctionData(functionFragment: "allowance", values: [string, string]): string;
    encodeFunctionData(functionFragment: "name", values?: undefined): string;
    encodeFunctionData(functionFragment: "symbol", values?: undefined): string;
    encodeFunctionData(functionFragment: "DOMAIN_SEPARATOR", values?: undefined): string;
    encodeFunctionData(functionFragment: "nonces", values: [string]): string;
    encodeFunctionData(functionFragment: "factory", values?: undefined): string;
    encodeFunctionData(functionFragment: "lp_token", values?: undefined): string;
    encodeFunctionData(functionFragment: "is_killed", values?: undefined): string;
    encodeFunctionData(functionFragment: "reward_count", values?: undefined): string;
    encodeFunctionData(functionFragment: "reward_data", values: [string]): string;
    encodeFunctionData(functionFragment: "rewards_receiver", values: [string]): string;
    encodeFunctionData(functionFragment: "reward_integral_for", values: [string, string]): string;
    encodeFunctionData(functionFragment: "working_balances", values: [string]): string;
    encodeFunctionData(functionFragment: "working_supply", values?: undefined): string;
    encodeFunctionData(functionFragment: "integrate_inv_supply_of", values: [string]): string;
    encodeFunctionData(functionFragment: "integrate_checkpoint_of", values: [string]): string;
    encodeFunctionData(functionFragment: "integrate_fraction", values: [string]): string;
    encodeFunctionData(functionFragment: "period", values?: undefined): string;
    encodeFunctionData(functionFragment: "reward_tokens", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "period_timestamp", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "integrate_inv_supply", values: [BigNumberish]): string;
    decodeFunctionResult(functionFragment: "deposit(uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "deposit(uint256,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "deposit(uint256,address,bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "withdraw(uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "withdraw(uint256,bool)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claim_rewards()", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claim_rewards(address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claim_rewards(address,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transferFrom", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transfer", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "approve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "permit", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "increaseAllowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "decreaseAllowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "user_checkpoint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_rewards_receiver", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "kick", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "deposit_reward_token", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "add_reward", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_reward_distributor", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_killed", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claimed_reward", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claimable_reward", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claimable_tokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "integrate_checkpoint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "future_epoch_time", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "inflation_rate", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "decimals", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "version", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "initialize", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "balanceOf", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "totalSupply", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "allowance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "name", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "symbol", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "DOMAIN_SEPARATOR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "nonces", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "factory", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lp_token", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "is_killed", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "reward_count", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "reward_data", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "rewards_receiver", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "reward_integral_for", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "working_balances", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "working_supply", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "integrate_inv_supply_of", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "integrate_checkpoint_of", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "integrate_fraction", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "period", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "reward_tokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "period_timestamp", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "integrate_inv_supply", data: BytesLike): Result;
    events: {
        "Deposit(address,uint256)": EventFragment;
        "Withdraw(address,uint256)": EventFragment;
        "UpdateLiquidityLimit(address,uint256,uint256,uint256,uint256)": EventFragment;
        "CommitOwnership(address)": EventFragment;
        "ApplyOwnership(address)": EventFragment;
        "Transfer(address,address,uint256)": EventFragment;
        "Approval(address,address,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "Deposit"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Withdraw"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "UpdateLiquidityLimit"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "CommitOwnership"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "ApplyOwnership"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Transfer"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Approval"): EventFragment;
}
export interface DepositEventObject {
    provider: string;
    value: BigNumber;
}
export declare type DepositEvent = TypedEvent<[string, BigNumber], DepositEventObject>;
export declare type DepositEventFilter = TypedEventFilter<DepositEvent>;
export interface WithdrawEventObject {
    provider: string;
    value: BigNumber;
}
export declare type WithdrawEvent = TypedEvent<[
    string,
    BigNumber
], WithdrawEventObject>;
export declare type WithdrawEventFilter = TypedEventFilter<WithdrawEvent>;
export interface UpdateLiquidityLimitEventObject {
    user: string;
    original_balance: BigNumber;
    original_supply: BigNumber;
    working_balance: BigNumber;
    working_supply: BigNumber;
}
export declare type UpdateLiquidityLimitEvent = TypedEvent<[
    string,
    BigNumber,
    BigNumber,
    BigNumber,
    BigNumber
], UpdateLiquidityLimitEventObject>;
export declare type UpdateLiquidityLimitEventFilter = TypedEventFilter<UpdateLiquidityLimitEvent>;
export interface CommitOwnershipEventObject {
    admin: string;
}
export declare type CommitOwnershipEvent = TypedEvent<[
    string
], CommitOwnershipEventObject>;
export declare type CommitOwnershipEventFilter = TypedEventFilter<CommitOwnershipEvent>;
export interface ApplyOwnershipEventObject {
    admin: string;
}
export declare type ApplyOwnershipEvent = TypedEvent<[
    string
], ApplyOwnershipEventObject>;
export declare type ApplyOwnershipEventFilter = TypedEventFilter<ApplyOwnershipEvent>;
export interface TransferEventObject {
    _from: string;
    _to: string;
    _value: BigNumber;
}
export declare type TransferEvent = TypedEvent<[
    string,
    string,
    BigNumber
], TransferEventObject>;
export declare type TransferEventFilter = TypedEventFilter<TransferEvent>;
export interface ApprovalEventObject {
    _owner: string;
    _spender: string;
    _value: BigNumber;
}
export declare type ApprovalEvent = TypedEvent<[
    string,
    string,
    BigNumber
], ApprovalEventObject>;
export declare type ApprovalEventFilter = TypedEventFilter<ApprovalEvent>;
export interface CurveLiquidityGaugeV5 extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: CurveLiquidityGaugeV5Interface;
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
        "deposit(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "deposit(uint256,address)"(_value: BigNumberish, _addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "deposit(uint256,address,bool)"(_value: BigNumberish, _addr: string, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "withdraw(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "withdraw(uint256,bool)"(_value: BigNumberish, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "claim_rewards()"(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "claim_rewards(address)"(_addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "claim_rewards(address,address)"(_addr: string, _receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        transferFrom(_from: string, _to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        transfer(_to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        approve(_spender: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        permit(_owner: string, _spender: string, _value: BigNumberish, _deadline: BigNumberish, _v: BigNumberish, _r: BytesLike, _s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        increaseAllowance(_spender: string, _added_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        decreaseAllowance(_spender: string, _subtracted_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        user_checkpoint(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_rewards_receiver(_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        kick(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        deposit_reward_token(_reward_token: string, _amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        add_reward(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_reward_distributor(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        claimed_reward(_addr: string, _token: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        claimable_reward(_user: string, _reward_token: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        claimable_tokens(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        integrate_checkpoint(overrides?: CallOverrides): Promise<[BigNumber]>;
        future_epoch_time(overrides?: CallOverrides): Promise<[BigNumber]>;
        inflation_rate(overrides?: CallOverrides): Promise<[BigNumber]>;
        decimals(overrides?: CallOverrides): Promise<[BigNumber]>;
        version(overrides?: CallOverrides): Promise<[string]>;
        initialize(_lp_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        balanceOf(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        totalSupply(overrides?: CallOverrides): Promise<[BigNumber]>;
        allowance(arg0: string, arg1: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        name(overrides?: CallOverrides): Promise<[string]>;
        symbol(overrides?: CallOverrides): Promise<[string]>;
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<[string]>;
        nonces(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        factory(overrides?: CallOverrides): Promise<[string]>;
        lp_token(overrides?: CallOverrides): Promise<[string]>;
        is_killed(overrides?: CallOverrides): Promise<[boolean]>;
        reward_count(overrides?: CallOverrides): Promise<[BigNumber]>;
        reward_data(arg0: string, overrides?: CallOverrides): Promise<[
            [
                string,
                string,
                BigNumber,
                BigNumber,
                BigNumber,
                BigNumber
            ] & {
                token: string;
                distributor: string;
                period_finish: BigNumber;
                rate: BigNumber;
                last_update: BigNumber;
                integral: BigNumber;
            }
        ]>;
        rewards_receiver(arg0: string, overrides?: CallOverrides): Promise<[string]>;
        reward_integral_for(arg0: string, arg1: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        working_balances(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        working_supply(overrides?: CallOverrides): Promise<[BigNumber]>;
        integrate_inv_supply_of(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        integrate_checkpoint_of(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        integrate_fraction(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        period(overrides?: CallOverrides): Promise<[BigNumber]>;
        reward_tokens(arg0: BigNumberish, overrides?: CallOverrides): Promise<[string]>;
        period_timestamp(arg0: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        integrate_inv_supply(arg0: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
    };
    "deposit(uint256)"(_value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "deposit(uint256,address)"(_value: BigNumberish, _addr: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "deposit(uint256,address,bool)"(_value: BigNumberish, _addr: string, _claim_rewards: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "withdraw(uint256)"(_value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "withdraw(uint256,bool)"(_value: BigNumberish, _claim_rewards: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "claim_rewards()"(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "claim_rewards(address)"(_addr: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "claim_rewards(address,address)"(_addr: string, _receiver: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    transferFrom(_from: string, _to: string, _value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    transfer(_to: string, _value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    approve(_spender: string, _value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    permit(_owner: string, _spender: string, _value: BigNumberish, _deadline: BigNumberish, _v: BigNumberish, _r: BytesLike, _s: BytesLike, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    increaseAllowance(_spender: string, _added_value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    decreaseAllowance(_spender: string, _subtracted_value: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    user_checkpoint(addr: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_rewards_receiver(_receiver: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    kick(addr: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    deposit_reward_token(_reward_token: string, _amount: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    add_reward(_reward_token: string, _distributor: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_reward_distributor(_reward_token: string, _distributor: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_killed(_is_killed: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    claimed_reward(_addr: string, _token: string, overrides?: CallOverrides): Promise<BigNumber>;
    claimable_reward(_user: string, _reward_token: string, overrides?: CallOverrides): Promise<BigNumber>;
    claimable_tokens(addr: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    integrate_checkpoint(overrides?: CallOverrides): Promise<BigNumber>;
    future_epoch_time(overrides?: CallOverrides): Promise<BigNumber>;
    inflation_rate(overrides?: CallOverrides): Promise<BigNumber>;
    decimals(overrides?: CallOverrides): Promise<BigNumber>;
    version(overrides?: CallOverrides): Promise<string>;
    initialize(_lp_token: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    balanceOf(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
    allowance(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
    name(overrides?: CallOverrides): Promise<string>;
    symbol(overrides?: CallOverrides): Promise<string>;
    DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<string>;
    nonces(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    factory(overrides?: CallOverrides): Promise<string>;
    lp_token(overrides?: CallOverrides): Promise<string>;
    is_killed(overrides?: CallOverrides): Promise<boolean>;
    reward_count(overrides?: CallOverrides): Promise<BigNumber>;
    reward_data(arg0: string, overrides?: CallOverrides): Promise<[
        string,
        string,
        BigNumber,
        BigNumber,
        BigNumber,
        BigNumber
    ] & {
        token: string;
        distributor: string;
        period_finish: BigNumber;
        rate: BigNumber;
        last_update: BigNumber;
        integral: BigNumber;
    }>;
    rewards_receiver(arg0: string, overrides?: CallOverrides): Promise<string>;
    reward_integral_for(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
    working_balances(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    working_supply(overrides?: CallOverrides): Promise<BigNumber>;
    integrate_inv_supply_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    integrate_checkpoint_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    integrate_fraction(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
    period(overrides?: CallOverrides): Promise<BigNumber>;
    reward_tokens(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;
    period_timestamp(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    integrate_inv_supply(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    callStatic: {
        "deposit(uint256)"(_value: BigNumberish, overrides?: CallOverrides): Promise<void>;
        "deposit(uint256,address)"(_value: BigNumberish, _addr: string, overrides?: CallOverrides): Promise<void>;
        "deposit(uint256,address,bool)"(_value: BigNumberish, _addr: string, _claim_rewards: boolean, overrides?: CallOverrides): Promise<void>;
        "withdraw(uint256)"(_value: BigNumberish, overrides?: CallOverrides): Promise<void>;
        "withdraw(uint256,bool)"(_value: BigNumberish, _claim_rewards: boolean, overrides?: CallOverrides): Promise<void>;
        "claim_rewards()"(overrides?: CallOverrides): Promise<void>;
        "claim_rewards(address)"(_addr: string, overrides?: CallOverrides): Promise<void>;
        "claim_rewards(address,address)"(_addr: string, _receiver: string, overrides?: CallOverrides): Promise<void>;
        transferFrom(_from: string, _to: string, _value: BigNumberish, overrides?: CallOverrides): Promise<boolean>;
        transfer(_to: string, _value: BigNumberish, overrides?: CallOverrides): Promise<boolean>;
        approve(_spender: string, _value: BigNumberish, overrides?: CallOverrides): Promise<boolean>;
        permit(_owner: string, _spender: string, _value: BigNumberish, _deadline: BigNumberish, _v: BigNumberish, _r: BytesLike, _s: BytesLike, overrides?: CallOverrides): Promise<boolean>;
        increaseAllowance(_spender: string, _added_value: BigNumberish, overrides?: CallOverrides): Promise<boolean>;
        decreaseAllowance(_spender: string, _subtracted_value: BigNumberish, overrides?: CallOverrides): Promise<boolean>;
        user_checkpoint(addr: string, overrides?: CallOverrides): Promise<boolean>;
        set_rewards_receiver(_receiver: string, overrides?: CallOverrides): Promise<void>;
        kick(addr: string, overrides?: CallOverrides): Promise<void>;
        deposit_reward_token(_reward_token: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<void>;
        add_reward(_reward_token: string, _distributor: string, overrides?: CallOverrides): Promise<void>;
        set_reward_distributor(_reward_token: string, _distributor: string, overrides?: CallOverrides): Promise<void>;
        set_killed(_is_killed: boolean, overrides?: CallOverrides): Promise<void>;
        claimed_reward(_addr: string, _token: string, overrides?: CallOverrides): Promise<BigNumber>;
        claimable_reward(_user: string, _reward_token: string, overrides?: CallOverrides): Promise<BigNumber>;
        claimable_tokens(addr: string, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_checkpoint(overrides?: CallOverrides): Promise<BigNumber>;
        future_epoch_time(overrides?: CallOverrides): Promise<BigNumber>;
        inflation_rate(overrides?: CallOverrides): Promise<BigNumber>;
        decimals(overrides?: CallOverrides): Promise<BigNumber>;
        version(overrides?: CallOverrides): Promise<string>;
        initialize(_lp_token: string, overrides?: CallOverrides): Promise<void>;
        balanceOf(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        allowance(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
        name(overrides?: CallOverrides): Promise<string>;
        symbol(overrides?: CallOverrides): Promise<string>;
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<string>;
        nonces(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        factory(overrides?: CallOverrides): Promise<string>;
        lp_token(overrides?: CallOverrides): Promise<string>;
        is_killed(overrides?: CallOverrides): Promise<boolean>;
        reward_count(overrides?: CallOverrides): Promise<BigNumber>;
        reward_data(arg0: string, overrides?: CallOverrides): Promise<[
            string,
            string,
            BigNumber,
            BigNumber,
            BigNumber,
            BigNumber
        ] & {
            token: string;
            distributor: string;
            period_finish: BigNumber;
            rate: BigNumber;
            last_update: BigNumber;
            integral: BigNumber;
        }>;
        rewards_receiver(arg0: string, overrides?: CallOverrides): Promise<string>;
        reward_integral_for(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
        working_balances(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        working_supply(overrides?: CallOverrides): Promise<BigNumber>;
        integrate_inv_supply_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_checkpoint_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_fraction(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        period(overrides?: CallOverrides): Promise<BigNumber>;
        reward_tokens(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;
        period_timestamp(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_inv_supply(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    };
    filters: {
        "Deposit(address,uint256)"(provider?: string | null, value?: null): DepositEventFilter;
        Deposit(provider?: string | null, value?: null): DepositEventFilter;
        "Withdraw(address,uint256)"(provider?: string | null, value?: null): WithdrawEventFilter;
        Withdraw(provider?: string | null, value?: null): WithdrawEventFilter;
        "UpdateLiquidityLimit(address,uint256,uint256,uint256,uint256)"(user?: string | null, original_balance?: null, original_supply?: null, working_balance?: null, working_supply?: null): UpdateLiquidityLimitEventFilter;
        UpdateLiquidityLimit(user?: string | null, original_balance?: null, original_supply?: null, working_balance?: null, working_supply?: null): UpdateLiquidityLimitEventFilter;
        "CommitOwnership(address)"(admin?: null): CommitOwnershipEventFilter;
        CommitOwnership(admin?: null): CommitOwnershipEventFilter;
        "ApplyOwnership(address)"(admin?: null): ApplyOwnershipEventFilter;
        ApplyOwnership(admin?: null): ApplyOwnershipEventFilter;
        "Transfer(address,address,uint256)"(_from?: string | null, _to?: string | null, _value?: null): TransferEventFilter;
        Transfer(_from?: string | null, _to?: string | null, _value?: null): TransferEventFilter;
        "Approval(address,address,uint256)"(_owner?: string | null, _spender?: string | null, _value?: null): ApprovalEventFilter;
        Approval(_owner?: string | null, _spender?: string | null, _value?: null): ApprovalEventFilter;
    };
    estimateGas: {
        "deposit(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "deposit(uint256,address)"(_value: BigNumberish, _addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "deposit(uint256,address,bool)"(_value: BigNumberish, _addr: string, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "withdraw(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "withdraw(uint256,bool)"(_value: BigNumberish, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "claim_rewards()"(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "claim_rewards(address)"(_addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "claim_rewards(address,address)"(_addr: string, _receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        transferFrom(_from: string, _to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        transfer(_to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        approve(_spender: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        permit(_owner: string, _spender: string, _value: BigNumberish, _deadline: BigNumberish, _v: BigNumberish, _r: BytesLike, _s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        increaseAllowance(_spender: string, _added_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        decreaseAllowance(_spender: string, _subtracted_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        user_checkpoint(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_rewards_receiver(_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        kick(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        deposit_reward_token(_reward_token: string, _amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        add_reward(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_reward_distributor(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        claimed_reward(_addr: string, _token: string, overrides?: CallOverrides): Promise<BigNumber>;
        claimable_reward(_user: string, _reward_token: string, overrides?: CallOverrides): Promise<BigNumber>;
        claimable_tokens(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        integrate_checkpoint(overrides?: CallOverrides): Promise<BigNumber>;
        future_epoch_time(overrides?: CallOverrides): Promise<BigNumber>;
        inflation_rate(overrides?: CallOverrides): Promise<BigNumber>;
        decimals(overrides?: CallOverrides): Promise<BigNumber>;
        version(overrides?: CallOverrides): Promise<BigNumber>;
        initialize(_lp_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        balanceOf(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        allowance(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
        name(overrides?: CallOverrides): Promise<BigNumber>;
        symbol(overrides?: CallOverrides): Promise<BigNumber>;
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<BigNumber>;
        nonces(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        factory(overrides?: CallOverrides): Promise<BigNumber>;
        lp_token(overrides?: CallOverrides): Promise<BigNumber>;
        is_killed(overrides?: CallOverrides): Promise<BigNumber>;
        reward_count(overrides?: CallOverrides): Promise<BigNumber>;
        reward_data(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        rewards_receiver(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        reward_integral_for(arg0: string, arg1: string, overrides?: CallOverrides): Promise<BigNumber>;
        working_balances(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        working_supply(overrides?: CallOverrides): Promise<BigNumber>;
        integrate_inv_supply_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_checkpoint_of(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_fraction(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;
        period(overrides?: CallOverrides): Promise<BigNumber>;
        reward_tokens(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        period_timestamp(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        integrate_inv_supply(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        "deposit(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "deposit(uint256,address)"(_value: BigNumberish, _addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "deposit(uint256,address,bool)"(_value: BigNumberish, _addr: string, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "withdraw(uint256)"(_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "withdraw(uint256,bool)"(_value: BigNumberish, _claim_rewards: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "claim_rewards()"(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "claim_rewards(address)"(_addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "claim_rewards(address,address)"(_addr: string, _receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        transferFrom(_from: string, _to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        transfer(_to: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        approve(_spender: string, _value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        permit(_owner: string, _spender: string, _value: BigNumberish, _deadline: BigNumberish, _v: BigNumberish, _r: BytesLike, _s: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        increaseAllowance(_spender: string, _added_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        decreaseAllowance(_spender: string, _subtracted_value: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        user_checkpoint(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_rewards_receiver(_receiver: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        kick(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        deposit_reward_token(_reward_token: string, _amount: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        add_reward(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_reward_distributor(_reward_token: string, _distributor: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        claimed_reward(_addr: string, _token: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        claimable_reward(_user: string, _reward_token: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        claimable_tokens(addr: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        integrate_checkpoint(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        future_epoch_time(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        inflation_rate(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        decimals(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        version(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        initialize(_lp_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        balanceOf(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        totalSupply(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        allowance(arg0: string, arg1: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        name(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        symbol(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        DOMAIN_SEPARATOR(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        nonces(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        factory(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lp_token(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        is_killed(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        reward_count(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        reward_data(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        rewards_receiver(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        reward_integral_for(arg0: string, arg1: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        working_balances(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        working_supply(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        integrate_inv_supply_of(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        integrate_checkpoint_of(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        integrate_fraction(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        period(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        reward_tokens(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        period_timestamp(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        integrate_inv_supply(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
