import assert from "assert";

import { Signer } from "@ethersproject/abstract-signer";
import { Overrides } from "@ethersproject/contracts";
import { Event } from "ethers";

import { _StabilioContract, _TypedStabilioContract, _TypedLogDescription } from "../src/contracts";
import { log } from "./deploy";

const factoryAbi = [
  "function createPair(address tokenA, address tokenB) returns (address pair)",
  "event PairCreated(address indexed token0, address indexed token1, address pair, uint)"
];

const factoryAddresses: Record<number, string> = {
  1: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  5: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
  11155111: "0xb7f907f7a9ebc822a80bd25e224be42ce0a698a0"
}

const hasFactory = (chainId: number) => factoryAddresses[chainId] != undefined;

interface UniswapV2Factory
  extends _TypedStabilioContract<
    unknown,
    { createPair(tokenA: string, tokenB: string, _overrides?: Overrides): Promise<string> }
  > {
  extractEvents(
    logs: Event[],
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

  const factory = (new _StabilioContract(
    factoryAddresses[chainId],
    factoryAbi,
    signer
  ) as unknown) as UniswapV2Factory;

  log(`Creating Uniswap v2 pair...`);

  const tx = await factory.createPair(tokenA, tokenB, { ...overrides });
  const receipt = await tx.wait();
  const events = ((receipt.events as unknown) as Event[]).filter((e) => e.event === 'PairCreated');
  assert(events.length === 1);

  const pairAddress = events[0].args?.pair;
  return pairAddress;
};
