import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result, EventFragment } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export declare namespace BondNFT {
    type LiquityDataAddressesStruct = {
        troveManagerAddress: string;
        lqtyToken: string;
        lqtyStaking: string;
        pickleLQTYJar: string;
        pickleLQTYFarm: string;
        curveGaugeController: string;
        curveLUSD3CRVGauge: string;
        curveLUSDFRAXGauge: string;
    };
    type LiquityDataAddressesStructOutput = [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string
    ] & {
        troveManagerAddress: string;
        lqtyToken: string;
        lqtyStaking: string;
        pickleLQTYJar: string;
        pickleLQTYFarm: string;
        curveGaugeController: string;
        curveLUSD3CRVGauge: string;
        curveLUSDFRAXGauge: string;
    };
}
export interface BondNFTInterface extends utils.Interface {
    functions: {
        "CURVE_GAUGE_SLOPES_PRECISION()": FunctionFragment;
        "approve(address,uint256)": FunctionFragment;
        "artwork()": FunctionFragment;
        "balanceOf(address)": FunctionFragment;
        "chickenBondManager()": FunctionFragment;
        "curveGaugeController()": FunctionFragment;
        "curveLUSD3CRVGauge()": FunctionFragment;
        "curveLUSDFRAXGauge()": FunctionFragment;
        "getApproved(uint256)": FunctionFragment;
        "getBondAmount(uint256)": FunctionFragment;
        "getBondClaimedBLUSD(uint256)": FunctionFragment;
        "getBondEndTime(uint256)": FunctionFragment;
        "getBondExtraData(uint256)": FunctionFragment;
        "getBondFinalDna(uint256)": FunctionFragment;
        "getBondFinalHalfDna(uint256)": FunctionFragment;
        "getBondInitialDna(uint256)": FunctionFragment;
        "getBondInitialHalfDna(uint256)": FunctionFragment;
        "getBondStartTime(uint256)": FunctionFragment;
        "getBondStatus(uint256)": FunctionFragment;
        "isApprovedForAll(address,address)": FunctionFragment;
        "lqtyStaking()": FunctionFragment;
        "lqtyToken()": FunctionFragment;
        "mint(address,uint256)": FunctionFragment;
        "name()": FunctionFragment;
        "owner()": FunctionFragment;
        "ownerOf(uint256)": FunctionFragment;
        "pickleLQTYFarm()": FunctionFragment;
        "pickleLQTYJar()": FunctionFragment;
        "renounceOwnership()": FunctionFragment;
        "safeTransferFrom(address,address,uint256)": FunctionFragment;
        "safeTransferFrom(address,address,uint256,bytes)": FunctionFragment;
        "setAddresses(address)": FunctionFragment;
        "setApprovalForAll(address,bool)": FunctionFragment;
        "setArtworkAddress(address)": FunctionFragment;
        "setFinalExtraData(address,uint256,uint256)": FunctionFragment;
        "supportsInterface(bytes4)": FunctionFragment;
        "symbol()": FunctionFragment;
        "tokenByIndex(uint256)": FunctionFragment;
        "tokenOfOwnerByIndex(address,uint256)": FunctionFragment;
        "tokenURI(uint256)": FunctionFragment;
        "totalSupply()": FunctionFragment;
        "transferFrom(address,address,uint256)": FunctionFragment;
        "transferLockoutPeriodSeconds()": FunctionFragment;
        "transferOwnership(address)": FunctionFragment;
        "troveManager()": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "CURVE_GAUGE_SLOPES_PRECISION" | "approve" | "artwork" | "balanceOf" | "chickenBondManager" | "curveGaugeController" | "curveLUSD3CRVGauge" | "curveLUSDFRAXGauge" | "getApproved" | "getBondAmount" | "getBondClaimedBLUSD" | "getBondEndTime" | "getBondExtraData" | "getBondFinalDna" | "getBondFinalHalfDna" | "getBondInitialDna" | "getBondInitialHalfDna" | "getBondStartTime" | "getBondStatus" | "isApprovedForAll" | "lqtyStaking" | "lqtyToken" | "mint" | "name" | "owner" | "ownerOf" | "pickleLQTYFarm" | "pickleLQTYJar" | "renounceOwnership" | "safeTransferFrom(address,address,uint256)" | "safeTransferFrom(address,address,uint256,bytes)" | "setAddresses" | "setApprovalForAll" | "setArtworkAddress" | "setFinalExtraData" | "supportsInterface" | "symbol" | "tokenByIndex" | "tokenOfOwnerByIndex" | "tokenURI" | "totalSupply" | "transferFrom" | "transferLockoutPeriodSeconds" | "transferOwnership" | "troveManager"): FunctionFragment;
    encodeFunctionData(functionFragment: "CURVE_GAUGE_SLOPES_PRECISION", values?: undefined): string;
    encodeFunctionData(functionFragment: "approve", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "artwork", values?: undefined): string;
    encodeFunctionData(functionFragment: "balanceOf", values: [string]): string;
    encodeFunctionData(functionFragment: "chickenBondManager", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveGaugeController", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveLUSD3CRVGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "curveLUSDFRAXGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "getApproved", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondAmount", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondClaimedBLUSD", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondEndTime", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondExtraData", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondFinalDna", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondFinalHalfDna", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondInitialDna", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondInitialHalfDna", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondStartTime", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getBondStatus", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "isApprovedForAll", values: [string, string]): string;
    encodeFunctionData(functionFragment: "lqtyStaking", values?: undefined): string;
    encodeFunctionData(functionFragment: "lqtyToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "mint", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "name", values?: undefined): string;
    encodeFunctionData(functionFragment: "owner", values?: undefined): string;
    encodeFunctionData(functionFragment: "ownerOf", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "pickleLQTYFarm", values?: undefined): string;
    encodeFunctionData(functionFragment: "pickleLQTYJar", values?: undefined): string;
    encodeFunctionData(functionFragment: "renounceOwnership", values?: undefined): string;
    encodeFunctionData(functionFragment: "safeTransferFrom(address,address,uint256)", values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "safeTransferFrom(address,address,uint256,bytes)", values: [string, string, BigNumberish, BytesLike]): string;
    encodeFunctionData(functionFragment: "setAddresses", values: [string]): string;
    encodeFunctionData(functionFragment: "setApprovalForAll", values: [string, boolean]): string;
    encodeFunctionData(functionFragment: "setArtworkAddress", values: [string]): string;
    encodeFunctionData(functionFragment: "setFinalExtraData", values: [string, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "supportsInterface", values: [BytesLike]): string;
    encodeFunctionData(functionFragment: "symbol", values?: undefined): string;
    encodeFunctionData(functionFragment: "tokenByIndex", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "tokenOfOwnerByIndex", values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "tokenURI", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "totalSupply", values?: undefined): string;
    encodeFunctionData(functionFragment: "transferFrom", values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: "transferLockoutPeriodSeconds", values?: undefined): string;
    encodeFunctionData(functionFragment: "transferOwnership", values: [string]): string;
    encodeFunctionData(functionFragment: "troveManager", values?: undefined): string;
    decodeFunctionResult(functionFragment: "CURVE_GAUGE_SLOPES_PRECISION", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "approve", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "artwork", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "balanceOf", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "chickenBondManager", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveGaugeController", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveLUSD3CRVGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "curveLUSDFRAXGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getApproved", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondAmount", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondClaimedBLUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondEndTime", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondExtraData", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondFinalDna", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondFinalHalfDna", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondInitialDna", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondInitialHalfDna", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondStartTime", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getBondStatus", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "isApprovedForAll", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lqtyStaking", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "lqtyToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "mint", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "name", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "owner", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "ownerOf", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "pickleLQTYFarm", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "pickleLQTYJar", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "renounceOwnership", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "safeTransferFrom(address,address,uint256)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "safeTransferFrom(address,address,uint256,bytes)", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "setAddresses", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "setApprovalForAll", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "setArtworkAddress", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "setFinalExtraData", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "supportsInterface", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "symbol", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "tokenByIndex", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "tokenOfOwnerByIndex", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "tokenURI", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "totalSupply", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transferFrom", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transferLockoutPeriodSeconds", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "transferOwnership", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "troveManager", data: BytesLike): Result;
    events: {
        "Approval(address,address,uint256)": EventFragment;
        "ApprovalForAll(address,address,bool)": EventFragment;
        "OwnershipTransferred(address,address)": EventFragment;
        "Transfer(address,address,uint256)": EventFragment;
    };
    getEvent(nameOrSignatureOrTopic: "Approval"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "ApprovalForAll"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "OwnershipTransferred"): EventFragment;
    getEvent(nameOrSignatureOrTopic: "Transfer"): EventFragment;
}
export interface ApprovalEventObject {
    owner: string;
    approved: string;
    tokenId: BigNumber;
}
export declare type ApprovalEvent = TypedEvent<[
    string,
    string,
    BigNumber
], ApprovalEventObject>;
export declare type ApprovalEventFilter = TypedEventFilter<ApprovalEvent>;
export interface ApprovalForAllEventObject {
    owner: string;
    operator: string;
    approved: boolean;
}
export declare type ApprovalForAllEvent = TypedEvent<[
    string,
    string,
    boolean
], ApprovalForAllEventObject>;
export declare type ApprovalForAllEventFilter = TypedEventFilter<ApprovalForAllEvent>;
export interface OwnershipTransferredEventObject {
    previousOwner: string;
    newOwner: string;
}
export declare type OwnershipTransferredEvent = TypedEvent<[
    string,
    string
], OwnershipTransferredEventObject>;
export declare type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>;
export interface TransferEventObject {
    from: string;
    to: string;
    tokenId: BigNumber;
}
export declare type TransferEvent = TypedEvent<[
    string,
    string,
    BigNumber
], TransferEventObject>;
export declare type TransferEventFilter = TypedEventFilter<TransferEvent>;
export interface BondNFT extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: BondNFTInterface;
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
        CURVE_GAUGE_SLOPES_PRECISION(overrides?: CallOverrides): Promise<[BigNumber]>;
        approve(to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        artwork(overrides?: CallOverrides): Promise<[string]>;
        balanceOf(owner: string, overrides?: CallOverrides): Promise<[BigNumber]>;
        chickenBondManager(overrides?: CallOverrides): Promise<[string]>;
        curveGaugeController(overrides?: CallOverrides): Promise<[string]>;
        curveLUSD3CRVGauge(overrides?: CallOverrides): Promise<[string]>;
        curveLUSDFRAXGauge(overrides?: CallOverrides): Promise<[string]>;
        getApproved(tokenId: BigNumberish, overrides?: CallOverrides): Promise<[string]>;
        getBondAmount(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            amount: BigNumber;
        }>;
        getBondClaimedBLUSD(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            claimedBLUSD: BigNumber;
        }>;
        getBondEndTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            endTime: BigNumber;
        }>;
        getBondExtraData(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            number,
            number,
            number
        ] & {
            initialHalfDna: BigNumber;
            finalHalfDna: BigNumber;
            troveSize: number;
            lqtyAmount: number;
            curveGaugeSlopes: number;
        }>;
        getBondFinalDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            finalDna: BigNumber;
        }>;
        getBondFinalHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            finalHalfDna: BigNumber;
        }>;
        getBondInitialDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            initialDna: BigNumber;
        }>;
        getBondInitialHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            initialHalfDna: BigNumber;
        }>;
        getBondStartTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            startTime: BigNumber;
        }>;
        getBondStatus(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[number] & {
            status: number;
        }>;
        isApprovedForAll(owner: string, operator: string, overrides?: CallOverrides): Promise<[boolean]>;
        lqtyStaking(overrides?: CallOverrides): Promise<[string]>;
        lqtyToken(overrides?: CallOverrides): Promise<[string]>;
        mint(_bonder: string, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        name(overrides?: CallOverrides): Promise<[string]>;
        owner(overrides?: CallOverrides): Promise<[string]>;
        ownerOf(tokenId: BigNumberish, overrides?: CallOverrides): Promise<[string]>;
        pickleLQTYFarm(overrides?: CallOverrides): Promise<[string]>;
        pickleLQTYJar(overrides?: CallOverrides): Promise<[string]>;
        renounceOwnership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "safeTransferFrom(address,address,uint256)"(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        "safeTransferFrom(address,address,uint256,bytes)"(from: string, to: string, tokenId: BigNumberish, _data: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        setAddresses(_chickenBondManagerAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        setApprovalForAll(operator: string, approved: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        setArtworkAddress(_artworkAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        setFinalExtraData(_bonder: string, _tokenID: BigNumberish, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        supportsInterface(interfaceId: BytesLike, overrides?: CallOverrides): Promise<[boolean]>;
        symbol(overrides?: CallOverrides): Promise<[string]>;
        tokenByIndex(index: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        tokenOfOwnerByIndex(owner: string, index: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;
        tokenURI(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[string]>;
        totalSupply(overrides?: CallOverrides): Promise<[BigNumber]>;
        transferFrom(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        transferLockoutPeriodSeconds(overrides?: CallOverrides): Promise<[BigNumber]>;
        transferOwnership(newOwner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        troveManager(overrides?: CallOverrides): Promise<[string]>;
    };
    CURVE_GAUGE_SLOPES_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
    approve(to: string, tokenId: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    artwork(overrides?: CallOverrides): Promise<string>;
    balanceOf(owner: string, overrides?: CallOverrides): Promise<BigNumber>;
    chickenBondManager(overrides?: CallOverrides): Promise<string>;
    curveGaugeController(overrides?: CallOverrides): Promise<string>;
    curveLUSD3CRVGauge(overrides?: CallOverrides): Promise<string>;
    curveLUSDFRAXGauge(overrides?: CallOverrides): Promise<string>;
    getApproved(tokenId: BigNumberish, overrides?: CallOverrides): Promise<string>;
    getBondAmount(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondClaimedBLUSD(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondEndTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondExtraData(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber,
        number,
        number,
        number
    ] & {
        initialHalfDna: BigNumber;
        finalHalfDna: BigNumber;
        troveSize: number;
        lqtyAmount: number;
        curveGaugeSlopes: number;
    }>;
    getBondFinalDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondFinalHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondInitialDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondInitialHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondStartTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getBondStatus(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<number>;
    isApprovedForAll(owner: string, operator: string, overrides?: CallOverrides): Promise<boolean>;
    lqtyStaking(overrides?: CallOverrides): Promise<string>;
    lqtyToken(overrides?: CallOverrides): Promise<string>;
    mint(_bonder: string, _permanentSeed: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    name(overrides?: CallOverrides): Promise<string>;
    owner(overrides?: CallOverrides): Promise<string>;
    ownerOf(tokenId: BigNumberish, overrides?: CallOverrides): Promise<string>;
    pickleLQTYFarm(overrides?: CallOverrides): Promise<string>;
    pickleLQTYJar(overrides?: CallOverrides): Promise<string>;
    renounceOwnership(overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "safeTransferFrom(address,address,uint256)"(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    "safeTransferFrom(address,address,uint256,bytes)"(from: string, to: string, tokenId: BigNumberish, _data: BytesLike, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    setAddresses(_chickenBondManagerAddress: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    setApprovalForAll(operator: string, approved: boolean, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    setArtworkAddress(_artworkAddress: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    setFinalExtraData(_bonder: string, _tokenID: BigNumberish, _permanentSeed: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    supportsInterface(interfaceId: BytesLike, overrides?: CallOverrides): Promise<boolean>;
    symbol(overrides?: CallOverrides): Promise<string>;
    tokenByIndex(index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    tokenOfOwnerByIndex(owner: string, index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    tokenURI(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<string>;
    totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
    transferFrom(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    transferLockoutPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
    transferOwnership(newOwner: string, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    troveManager(overrides?: CallOverrides): Promise<string>;
    callStatic: {
        CURVE_GAUGE_SLOPES_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
        approve(to: string, tokenId: BigNumberish, overrides?: CallOverrides): Promise<void>;
        artwork(overrides?: CallOverrides): Promise<string>;
        balanceOf(owner: string, overrides?: CallOverrides): Promise<BigNumber>;
        chickenBondManager(overrides?: CallOverrides): Promise<string>;
        curveGaugeController(overrides?: CallOverrides): Promise<string>;
        curveLUSD3CRVGauge(overrides?: CallOverrides): Promise<string>;
        curveLUSDFRAXGauge(overrides?: CallOverrides): Promise<string>;
        getApproved(tokenId: BigNumberish, overrides?: CallOverrides): Promise<string>;
        getBondAmount(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondClaimedBLUSD(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondEndTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondExtraData(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber,
            number,
            number,
            number
        ] & {
            initialHalfDna: BigNumber;
            finalHalfDna: BigNumber;
            troveSize: number;
            lqtyAmount: number;
            curveGaugeSlopes: number;
        }>;
        getBondFinalDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondFinalHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondInitialDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondInitialHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondStartTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondStatus(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<number>;
        isApprovedForAll(owner: string, operator: string, overrides?: CallOverrides): Promise<boolean>;
        lqtyStaking(overrides?: CallOverrides): Promise<string>;
        lqtyToken(overrides?: CallOverrides): Promise<string>;
        mint(_bonder: string, _permanentSeed: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber, BigNumber]>;
        name(overrides?: CallOverrides): Promise<string>;
        owner(overrides?: CallOverrides): Promise<string>;
        ownerOf(tokenId: BigNumberish, overrides?: CallOverrides): Promise<string>;
        pickleLQTYFarm(overrides?: CallOverrides): Promise<string>;
        pickleLQTYJar(overrides?: CallOverrides): Promise<string>;
        renounceOwnership(overrides?: CallOverrides): Promise<void>;
        "safeTransferFrom(address,address,uint256)"(from: string, to: string, tokenId: BigNumberish, overrides?: CallOverrides): Promise<void>;
        "safeTransferFrom(address,address,uint256,bytes)"(from: string, to: string, tokenId: BigNumberish, _data: BytesLike, overrides?: CallOverrides): Promise<void>;
        setAddresses(_chickenBondManagerAddress: string, overrides?: CallOverrides): Promise<void>;
        setApprovalForAll(operator: string, approved: boolean, overrides?: CallOverrides): Promise<void>;
        setArtworkAddress(_artworkAddress: string, overrides?: CallOverrides): Promise<void>;
        setFinalExtraData(_bonder: string, _tokenID: BigNumberish, _permanentSeed: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        supportsInterface(interfaceId: BytesLike, overrides?: CallOverrides): Promise<boolean>;
        symbol(overrides?: CallOverrides): Promise<string>;
        tokenByIndex(index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        tokenOfOwnerByIndex(owner: string, index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        tokenURI(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<string>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        transferFrom(from: string, to: string, tokenId: BigNumberish, overrides?: CallOverrides): Promise<void>;
        transferLockoutPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>;
        troveManager(overrides?: CallOverrides): Promise<string>;
    };
    filters: {
        "Approval(address,address,uint256)"(owner?: string | null, approved?: string | null, tokenId?: BigNumberish | null): ApprovalEventFilter;
        Approval(owner?: string | null, approved?: string | null, tokenId?: BigNumberish | null): ApprovalEventFilter;
        "ApprovalForAll(address,address,bool)"(owner?: string | null, operator?: string | null, approved?: null): ApprovalForAllEventFilter;
        ApprovalForAll(owner?: string | null, operator?: string | null, approved?: null): ApprovalForAllEventFilter;
        "OwnershipTransferred(address,address)"(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter;
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter;
        "Transfer(address,address,uint256)"(from?: string | null, to?: string | null, tokenId?: BigNumberish | null): TransferEventFilter;
        Transfer(from?: string | null, to?: string | null, tokenId?: BigNumberish | null): TransferEventFilter;
    };
    estimateGas: {
        CURVE_GAUGE_SLOPES_PRECISION(overrides?: CallOverrides): Promise<BigNumber>;
        approve(to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        artwork(overrides?: CallOverrides): Promise<BigNumber>;
        balanceOf(owner: string, overrides?: CallOverrides): Promise<BigNumber>;
        chickenBondManager(overrides?: CallOverrides): Promise<BigNumber>;
        curveGaugeController(overrides?: CallOverrides): Promise<BigNumber>;
        curveLUSD3CRVGauge(overrides?: CallOverrides): Promise<BigNumber>;
        curveLUSDFRAXGauge(overrides?: CallOverrides): Promise<BigNumber>;
        getApproved(tokenId: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondAmount(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondClaimedBLUSD(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondEndTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondExtraData(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondFinalDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondFinalHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondInitialDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondInitialHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondStartTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getBondStatus(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        isApprovedForAll(owner: string, operator: string, overrides?: CallOverrides): Promise<BigNumber>;
        lqtyStaking(overrides?: CallOverrides): Promise<BigNumber>;
        lqtyToken(overrides?: CallOverrides): Promise<BigNumber>;
        mint(_bonder: string, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        name(overrides?: CallOverrides): Promise<BigNumber>;
        owner(overrides?: CallOverrides): Promise<BigNumber>;
        ownerOf(tokenId: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        pickleLQTYFarm(overrides?: CallOverrides): Promise<BigNumber>;
        pickleLQTYJar(overrides?: CallOverrides): Promise<BigNumber>;
        renounceOwnership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "safeTransferFrom(address,address,uint256)"(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        "safeTransferFrom(address,address,uint256,bytes)"(from: string, to: string, tokenId: BigNumberish, _data: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        setAddresses(_chickenBondManagerAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        setApprovalForAll(operator: string, approved: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        setArtworkAddress(_artworkAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        setFinalExtraData(_bonder: string, _tokenID: BigNumberish, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        supportsInterface(interfaceId: BytesLike, overrides?: CallOverrides): Promise<BigNumber>;
        symbol(overrides?: CallOverrides): Promise<BigNumber>;
        tokenByIndex(index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        tokenOfOwnerByIndex(owner: string, index: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        tokenURI(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
        transferFrom(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        transferLockoutPeriodSeconds(overrides?: CallOverrides): Promise<BigNumber>;
        transferOwnership(newOwner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        troveManager(overrides?: CallOverrides): Promise<BigNumber>;
    };
    populateTransaction: {
        CURVE_GAUGE_SLOPES_PRECISION(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        approve(to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        artwork(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        balanceOf(owner: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        chickenBondManager(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveGaugeController(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveLUSD3CRVGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        curveLUSDFRAXGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getApproved(tokenId: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondAmount(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondClaimedBLUSD(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondEndTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondExtraData(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondFinalDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondFinalHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondInitialDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondInitialHalfDna(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondStartTime(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getBondStatus(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        isApprovedForAll(owner: string, operator: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lqtyStaking(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        lqtyToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        mint(_bonder: string, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        name(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        ownerOf(tokenId: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        pickleLQTYFarm(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        pickleLQTYJar(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        renounceOwnership(overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "safeTransferFrom(address,address,uint256)"(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        "safeTransferFrom(address,address,uint256,bytes)"(from: string, to: string, tokenId: BigNumberish, _data: BytesLike, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        setAddresses(_chickenBondManagerAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        setApprovalForAll(operator: string, approved: boolean, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        setArtworkAddress(_artworkAddress: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        setFinalExtraData(_bonder: string, _tokenID: BigNumberish, _permanentSeed: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        supportsInterface(interfaceId: BytesLike, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        symbol(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        tokenByIndex(index: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        tokenOfOwnerByIndex(owner: string, index: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        tokenURI(_tokenID: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        totalSupply(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        transferFrom(from: string, to: string, tokenId: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        transferLockoutPeriodSeconds(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        transferOwnership(newOwner: string, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        troveManager(overrides?: CallOverrides): Promise<PopulatedTransaction>;
    };
}
