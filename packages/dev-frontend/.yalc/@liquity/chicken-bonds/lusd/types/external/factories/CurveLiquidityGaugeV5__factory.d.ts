import { Signer } from "ethers";
import type { Provider } from "@ethersproject/providers";
import type { CurveLiquidityGaugeV5, CurveLiquidityGaugeV5Interface } from "../CurveLiquidityGaugeV5";
export declare class CurveLiquidityGaugeV5__factory {
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
        inputs: never[];
        outputs: never[];
        name?: undefined;
        anonymous?: undefined;
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
            components: {
                name: string;
                type: string;
            }[];
        }[];
        anonymous?: undefined;
    })[];
    static createInterface(): CurveLiquidityGaugeV5Interface;
    static connect(address: string, signerOrProvider: Signer | Provider): CurveLiquidityGaugeV5;
}
