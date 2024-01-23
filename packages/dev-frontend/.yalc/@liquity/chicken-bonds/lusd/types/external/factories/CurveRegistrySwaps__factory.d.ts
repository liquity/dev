import { Signer } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type { CurveRegistrySwaps, CurveRegistrySwapsInterface } from "../CurveRegistrySwaps";
export declare class CurveRegistrySwaps__factory {
    static readonly abi: ({
        anonymous: boolean;
        inputs: {
            indexed: boolean;
            name: string;
            type: string;
        }[];
        name: string;
        type: string;
        outputs?: undefined;
        stateMutability?: undefined;
    } | {
        inputs: {
            name: string;
            type: string;
        }[];
        outputs: never[];
        stateMutability: string;
        type: string;
        anonymous?: undefined;
        name?: undefined;
    } | {
        stateMutability: string;
        type: string;
        anonymous?: undefined;
        inputs?: undefined;
        name?: undefined;
        outputs?: undefined;
    } | {
        inputs: {
            name: string;
            type: string;
        }[];
        name: string;
        outputs: {
            name: string;
            type: string;
        }[];
        stateMutability: string;
        type: string;
        anonymous?: undefined;
    })[];
    static createInterface(): CurveRegistrySwapsInterface;
    static connect(address: string, signerOrProvider: Signer | Provider): CurveRegistrySwaps;
}
