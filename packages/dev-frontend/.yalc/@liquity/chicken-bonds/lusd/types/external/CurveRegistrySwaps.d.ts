import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PayableOverrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface CurveRegistrySwapsInterface extends utils.Interface {
    functions: {
        "exchange_with_best_rate(address,address,uint256,uint256)": FunctionFragment;
        "exchange_with_best_rate(address,address,uint256,uint256,address)": FunctionFragment;
        "exchange(address,address,address,uint256,uint256)": FunctionFragment;
        "exchange(address,address,address,uint256,uint256,address)": FunctionFragment;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256)": FunctionFragment;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])": FunctionFragment;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)": FunctionFragment;
        "get_best_rate(address,address,uint256)": FunctionFragment;
        "get_best_rate(address,address,uint256,address[8])": FunctionFragment;
        "get_exchange_amount(address,address,address,uint256)": FunctionFragment;
        "get_input_amount(address,address,address,uint256)": FunctionFragment;
        "get_exchange_amounts(address,address,address,uint256[100])": FunctionFragment;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)": FunctionFragment;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])": FunctionFragment;
        "get_calculator(address)": FunctionFragment;
        "update_registry_address()": FunctionFragment;
        "set_calculator(address,address)": FunctionFragment;
        "set_default_calculator(address)": FunctionFragment;
        "claim_balance(address)": FunctionFragment;
        "set_killed(bool)": FunctionFragment;
        "registry()": FunctionFragment;
        "factory_registry()": FunctionFragment;
        "crypto_registry()": FunctionFragment;
        "default_calculator()": FunctionFragment;
        "is_killed()": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "exchange_with_best_rate(address,address,uint256,uint256)" | "exchange_with_best_rate(address,address,uint256,uint256,address)" | "exchange(address,address,address,uint256,uint256)" | "exchange(address,address,address,uint256,uint256,address)" | "exchange_multiple(address[9],uint256[3][4],uint256,uint256)" | "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])" | "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)" | "get_best_rate(address,address,uint256)" | "get_best_rate(address,address,uint256,address[8])" | "get_exchange_amount" | "get_input_amount" | "get_exchange_amounts" | "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)" | "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])" | "get_calculator" | "update_registry_address" | "set_calculator" | "set_default_calculator" | "claim_balance" | "set_killed" | "registry" | "factory_registry" | "crypto_registry" | "default_calculator" | "is_killed"): FunctionFragment;
    encodeFunctionData(functionFragment: "exchange_with_best_rate(address,address,uint256,uint256)", values: [string, string, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "exchange_with_best_rate(address,address,uint256,uint256,address)", values: [string, string, BigNumberish, BigNumberish, string]): string;
    encodeFunctionData(functionFragment: "exchange(address,address,address,uint256,uint256)", values: [string, string, string, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "exchange(address,address,address,uint256,uint256,address)", values: [string, string, string, BigNumberish, BigNumberish, string]): string;
    encodeFunctionData(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256)", values: [
        string[],
        [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ],
        BigNumberish,
        BigNumberish
    ]): string;
    encodeFunctionData(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])", values: [
        string[],
        [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ],
        BigNumberish,
        BigNumberish,
        [
            string,
            string,
            string,
            string
        ]
    ]): string;
    encodeFunctionData(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)", values: [
        string[],
        [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ],
        BigNumberish,
        BigNumberish,
        [
            string,
            string,
            string,
            string
        ],
        string
    ]): string;
    encodeFunctionData(functionFragment: "get_best_rate(address,address,uint256)", values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "get_best_rate(address,address,uint256,address[8])", values: [string, string, BigNumberish, string[]]): string;
    encodeFunctionData(functionFragment: "get_exchange_amount", values: [string, string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "get_input_amount", values: [string, string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "get_exchange_amounts", values: [string, string, string, BigNumberish[]]): string;
    encodeFunctionData(functionFragment: "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)", values: [
        string[],
        [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ],
        BigNumberish
    ]): string;
    encodeFunctionData(functionFragment: "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])", values: [
        string[],
        [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ],
        BigNumberish,
        [
            string,
            string,
            string,
            string
        ]
    ]): string;
    encodeFunctionData(functionFragment: "get_calculator", values: [string]): string;
    encodeFunctionData(functionFragment: "update_registry_address", values?: undefined): string;
    encodeFunctionData(functionFragment: "set_calculator", values: [string, string]): string;
    encodeFunctionData(functionFragment: "set_default_calculator", values: [string]): string;
    encodeFunctionData(functionFragment: "claim_balance", values: [string]): string;
    encodeFunctionData(functionFragment: "set_killed", values: [boolean]): string;
    encodeFunctionData(functionFragment: "registry", values?: undefined): string;
    encodeFunctionData(functionFragment: "factory_registry", values?: undefined): string;
    encodeFunctionData(functionFragment: "crypto_registry", values?: undefined): string;
    encodeFunctionData(functionFragment: "default_calculator", values?: undefined): string;
    encodeFunctionData(functionFragment: "is_killed", values?: undefined): string;
    decodeFunctionResult(functionFragment: "exchange_with_best_rate(address,address,uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_with_best_rate(address,address,uint256,uint256,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange(address,address,address,uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange(address,address,address,uint256,uint256,address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_best_rate(address,address,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_best_rate(address,address,uint256,address[8])", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_exchange_amount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_input_amount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_exchange_amounts", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "get_calculator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "update_registry_address", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_calculator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_default_calculator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "claim_balance", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "set_killed", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "registry", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "factory_registry", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "crypto_registry", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "default_calculator", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "is_killed", data: BytesLike): Result;
    events: {
        "TokenExchange(address,address,address,address,address,uint256,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "TokenExchange"): EventFragment;
}
export interface TokenExchangeEventObject {
    buyer: string;
    receiver: string;
    pool: string;
    token_sold: string;
    token_bought: string;
    amount_sold: BigNumber;
    amount_bought: BigNumber;
}
export declare type TokenExchangeEvent = TypedEvent<[
    string,
    string,
    string,
    string,
    string,
    BigNumber,
    BigNumber
], TokenExchangeEventObject>;
export declare type TokenExchangeEventFilter = TypedEventFilter<TokenExchangeEvent>;
export interface CurveRegistrySwaps extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: CurveRegistrySwapsInterface;
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
        "exchange_with_best_rate(address,address,uint256,uint256)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_with_best_rate(address,address,uint256,uint256,address)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange(address,address,address,uint256,uint256)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange(address,address,address,uint256,uint256,address)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "get_best_rate(address,address,uint256)"(_from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<[string, BigNumber]>;
        "get_best_rate(address,address,uint256,address[8])"(_from: string, _to: string, _amount: BigNumberish, _exclude_pools: string[], overrides?: CallOverrides): Promise<[string, BigNumber]>;
        get_exchange_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        get_input_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        get_exchange_amounts(_pool: string, _from: string, _to: string, _amounts: BigNumberish[], overrides?: CallOverrides): Promise<[BigNumber[]]>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<[BigNumber]>;
        get_calculator(_pool: string, overrides?: CallOverrides): Promise<[string]>;
        update_registry_address(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_calculator(_pool: string, _calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_default_calculator(_calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        claim_balance(_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        registry(overrides?: CallOverrides): Promise<[string]>;
        factory_registry(overrides?: CallOverrides): Promise<[string]>;
        crypto_registry(overrides?: CallOverrides): Promise<[string]>;
        default_calculator(overrides?: CallOverrides): Promise<[string]>;
        is_killed(overrides?: CallOverrides): Promise<[boolean]>;
    };
    "exchange_with_best_rate(address,address,uint256,uint256)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_with_best_rate(address,address,uint256,uint256,address)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange(address,address,address,uint256,uint256)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange(address,address,address,uint256,uint256,address)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"(_route: string[], _swap_params: [
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ]
    ], _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])"(_route: string[], _swap_params: [
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ]
    ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)"(_route: string[], _swap_params: [
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ]
    ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], _receiver: string, overrides?: PayableOverrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "get_best_rate(address,address,uint256)"(_from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<[string, BigNumber]>;
    "get_best_rate(address,address,uint256,address[8])"(_from: string, _to: string, _amount: BigNumberish, _exclude_pools: string[], overrides?: CallOverrides): Promise<[string, BigNumber]>;
    get_exchange_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    get_input_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    get_exchange_amounts(_pool: string, _from: string, _to: string, _amounts: BigNumberish[], overrides?: CallOverrides): Promise<BigNumber[]>;
    "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"(_route: string[], _swap_params: [
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ]
    ], _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])"(_route: string[], _swap_params: [
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ],
        [
            BigNumberish,
            BigNumberish,
            BigNumberish
        ]
    ], _amount: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<BigNumber>;
    get_calculator(_pool: string, overrides?: CallOverrides): Promise<string>;
    update_registry_address(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_calculator(_pool: string, _calculator: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_default_calculator(_calculator: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    claim_balance(_token: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    set_killed(_is_killed: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    registry(overrides?: CallOverrides): Promise<string>;
    factory_registry(overrides?: CallOverrides): Promise<string>;
    crypto_registry(overrides?: CallOverrides): Promise<string>;
    default_calculator(overrides?: CallOverrides): Promise<string>;
    is_killed(overrides?: CallOverrides): Promise<boolean>;
    callStatic: {
        "exchange_with_best_rate(address,address,uint256,uint256)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_with_best_rate(address,address,uint256,uint256,address)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(address,address,address,uint256,uint256)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange(address,address,address,uint256,uint256,address)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], _receiver: string, overrides?: CallOverrides): Promise<BigNumber>;
        "get_best_rate(address,address,uint256)"(_from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<[string, BigNumber]>;
        "get_best_rate(address,address,uint256,address[8])"(_from: string, _to: string, _amount: BigNumberish, _exclude_pools: string[], overrides?: CallOverrides): Promise<[string, BigNumber]>;
        get_exchange_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        get_input_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        get_exchange_amounts(_pool: string, _from: string, _to: string, _amounts: BigNumberish[], overrides?: CallOverrides): Promise<BigNumber[]>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<BigNumber>;
        get_calculator(_pool: string, overrides?: CallOverrides): Promise<string>;
        update_registry_address(overrides?: CallOverrides): Promise<boolean>;
        set_calculator(_pool: string, _calculator: string, overrides?: CallOverrides): Promise<boolean>;
        set_default_calculator(_calculator: string, overrides?: CallOverrides): Promise<boolean>;
        claim_balance(_token: string, overrides?: CallOverrides): Promise<boolean>;
        set_killed(_is_killed: boolean, overrides?: CallOverrides): Promise<boolean>;
        registry(overrides?: CallOverrides): Promise<string>;
        factory_registry(overrides?: CallOverrides): Promise<string>;
        crypto_registry(overrides?: CallOverrides): Promise<string>;
        default_calculator(overrides?: CallOverrides): Promise<string>;
        is_killed(overrides?: CallOverrides): Promise<boolean>;
    };
    filters: {
        "TokenExchange(address,address,address,address,address,uint256,uint256)"(buyer?: string | null, receiver?: string | null, pool?: string | null, token_sold?: null, token_bought?: null, amount_sold?: null, amount_bought?: null): TokenExchangeEventFilter;
        TokenExchange(buyer?: string | null, receiver?: string | null, pool?: string | null, token_sold?: null, token_bought?: null, amount_sold?: null, amount_bought?: null): TokenExchangeEventFilter;
    };
    estimateGas: {
        "exchange_with_best_rate(address,address,uint256,uint256)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_with_best_rate(address,address,uint256,uint256,address)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange(address,address,address,uint256,uint256)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange(address,address,address,uint256,uint256,address)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "get_best_rate(address,address,uint256)"(_from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "get_best_rate(address,address,uint256,address[8])"(_from: string, _to: string, _amount: BigNumberish, _exclude_pools: string[], overrides?: CallOverrides): Promise<BigNumber>;
        get_exchange_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        get_input_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        get_exchange_amounts(_pool: string, _from: string, _to: string, _amounts: BigNumberish[], overrides?: CallOverrides): Promise<BigNumber>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<BigNumber>;
        get_calculator(_pool: string, overrides?: CallOverrides): Promise<BigNumber>;
        update_registry_address(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_calculator(_pool: string, _calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_default_calculator(_calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        claim_balance(_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        registry(overrides?: CallOverrides): Promise<BigNumber>;
        factory_registry(overrides?: CallOverrides): Promise<BigNumber>;
        crypto_registry(overrides?: CallOverrides): Promise<BigNumber>;
        default_calculator(overrides?: CallOverrides): Promise<BigNumber>;
        is_killed(overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        "exchange_with_best_rate(address,address,uint256,uint256)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_with_best_rate(address,address,uint256,uint256,address)"(_from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange(address,address,address,uint256,uint256)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange(address,address,address,uint256,uint256,address)"(_pool: string, _from: string, _to: string, _amount: BigNumberish, _expected: BigNumberish, _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "exchange_multiple(address[9],uint256[3][4],uint256,uint256,address[4],address)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _expected: BigNumberish, _pools: [string, string, string, string], _receiver: string, overrides?: PayableOverrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "get_best_rate(address,address,uint256)"(_from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "get_best_rate(address,address,uint256,address[8])"(_from: string, _to: string, _amount: BigNumberish, _exclude_pools: string[], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        get_exchange_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        get_input_amount(_pool: string, _from: string, _to: string, _amount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        get_exchange_amounts(_pool: string, _from: string, _to: string, _amounts: BigNumberish[], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256)"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        "get_exchange_multiple_amount(address[9],uint256[3][4],uint256,address[4])"(_route: string[], _swap_params: [
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ],
            [
                BigNumberish,
                BigNumberish,
                BigNumberish
            ]
        ], _amount: BigNumberish, _pools: [string, string, string, string], overrides?: CallOverrides): Promise<PopulatedTransaction>;
        get_calculator(_pool: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        update_registry_address(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_calculator(_pool: string, _calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_default_calculator(_calculator: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        claim_balance(_token: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        set_killed(_is_killed: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        registry(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        factory_registry(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        crypto_registry(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        default_calculator(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        is_killed(overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
