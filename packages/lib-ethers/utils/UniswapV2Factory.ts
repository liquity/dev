import assert from "assert";

import { Log } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Overrides } from "@ethersproject/contracts";

import { _LiquityContract, _TypedLiquityContract, _TypedLogDescription } from "../src/contracts";
import { log } from "./deploy";

const factoryAbi = [
  "function createPair(address tokenA, address tokenB) returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

const factoryAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

const hasFactory = (chainId: number) => [1, 3, 4, 5, 42].includes(chainId);

interface UniswapV2Factory
  extends _TypedLiquityContract<
    unknown,
    { createPair(tokenA: string, tokenB: string, _overrides?: Overrides): Promise<string> }
  > {
  extractEvents(
    logs: Log[],
    name: "PairCreated"
  ): _TypedLogDescription<{ token0: string; token1: string; pair: string }>[];
}

export const createUniswapV2Pair = async (
  signer: Signer,
  tokenA: string,
  tokenB: string,
  overrides?: Overrides
): Promise<string> => {
  const chainId = await signer.getChainId();

  if (!hasFactory(chainId)) {
    throw new Error(`UniswapV2Factory is not deployed on this network (chainId = ${chainId})`);
  }

  const factory = (new _LiquityContract(
    factoryAddress,
    factoryAbi,
    signer
  ) as unknown) as UniswapV2Factory;

  log(`Creating Uniswap v2 WETH <=> LUSD pair...`);

  const tx = await factory.createPair(tokenA, tokenB, { ...overrides });
  const receipt = await tx.wait();
  const pairCreatedEvents = factory.extractEvents(receipt.logs, "PairCreated");

  assert(pairCreatedEvents.length === 1);
  return pairCreatedEvents[0].args.pair;
};
