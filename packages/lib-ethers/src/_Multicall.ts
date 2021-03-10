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
  3: "0x53c43764255c17bd724f74c4ef150724ac50a3ed",
  4: "0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821",
  5: "0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e",
  42: "0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a"
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
