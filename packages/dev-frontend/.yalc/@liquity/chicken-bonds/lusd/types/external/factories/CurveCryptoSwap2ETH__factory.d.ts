import { Signer } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type { CurveCryptoSwap2ETH, CurveCryptoSwap2ETHInterface } from "../CurveCryptoSwap2ETH";
export declare class CurveCryptoSwap2ETH__factory {
    static readonly abi: ({
        name: string;
        inputs: {
            name: string;
            type: string;
            indexed: boolean;
        }[];
        anonymous: boolean;
        type: string;
        stateMutability?: undefined;
        outputs?: undefined;
    } | {
        stateMutability: string;
        type: string;
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: never[];
        name?: undefined;
        anonymous?: undefined;
    } | {
        stateMutability: string;
        type: string;
        name?: undefined;
        inputs?: undefined;
        anonymous?: undefined;
        outputs?: undefined;
    } | {
        stateMutability: string;
        type: string;
        name: string;
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: {
            name: string;
            type: string;
        }[];
        anonymous?: undefined;
    })[];
    static createInterface(): CurveCryptoSwap2ETHInterface;
    static connect(address: string, signerOrProvider: Signer | Provider): CurveCryptoSwap2ETH;
}
