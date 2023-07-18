import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { CallOverrides, Contract } from "@ethersproject/contracts";

import { _TypeSafeContract } from "./contracts";

const multicallAbi = [
  {
    constant: true,
    inputs: [],
    name: "getCurrentBlockTimestamp",
    outputs: [
      {
        name: "timestamp",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function"
  }
];

const multicallAddress = {
  1: "0xeefba1e63905ef1d7acba5a8513c70307c1ce441",
  11155111: "0xcA11bde05977b3631167028862bE2a173976CA11"
};

const hasMulticall = (chainId: number): chainId is keyof typeof multicallAddress =>
  chainId in multicallAddress;

export interface _Multicall extends _TypeSafeContract<Contract> {
  getCurrentBlockTimestamp(overrides?: CallOverrides): Promise<BigNumber>;
}

export const _connectToMulticall = (
  signerOrProvider: Signer | Provider,
  chainId: number
): _Multicall | undefined =>
  hasMulticall(chainId)
    ? ((new Contract(
        multicallAddress[chainId],
        multicallAbi,
        signerOrProvider
      ) as unknown) as _Multicall)
    : undefined;
