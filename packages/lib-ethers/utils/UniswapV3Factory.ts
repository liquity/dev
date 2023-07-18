import assert from "assert";

import { Log } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { Overrides } from "@ethersproject/contracts";

import { _LiquityContract, _TypedLiquityContract, _TypedLogDescription } from "../src/contracts";
import { log } from "./deploy";
import { BigNumberish } from "ethers";

const factoryAbi = [
  "function createPool(address tokenA, address tokenB, uint24 fee) returns (address pool)",
  "event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)"
];

const factoryAddresses: Record<number, string> = {
  1: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  5: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  11155111: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c"
}

const hasFactory = (chainId: number) => factoryAddresses[chainId] != undefined;

interface UniswapV3Factory
  extends _TypedLiquityContract<
    unknown,
    { createPool(tokenA: string, tokenB: string, fee: number, _overrides?: Overrides): Promise<string> }
  > {
  extractEvents(
    logs: Log[],
    name: "PoolCreated"
  ): _TypedLogDescription<{ token0: string; token1: string; fee: BigNumberish; tickSpacing: BigNumberish; pool: string }>[];
}

export const createUniswapV3Pool = async (
  signer: Signer,
  tokenA: string,
  tokenB: string,
  fee: number,
  overrides?: Overrides
): Promise<string> => {
  const chainId = await signer.getChainId();

  if (!hasFactory(chainId)) {
    throw new Error(`UniswapV3Factory is not deployed on this network (chainId = ${chainId})`);
  }

  const factory = (new _LiquityContract(
    factoryAddresses[chainId],
    factoryAbi,
    signer
  ) as unknown) as UniswapV3Factory;

  log(`Creating Uniswap v3 pair...`);

  const tx = await factory.createPool(tokenA, tokenB, fee, { ...overrides });
  const receipt = await tx.wait();
  const poolCreatedEvents = factory.extractEvents(receipt.logs, "PoolCreated");

  assert(poolCreatedEvents.length === 1);
  return poolCreatedEvents[0].args.pool;
};
