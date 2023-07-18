import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";

import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  CallOverrides,
  PopulatedTransaction,
  ContractTransaction
} from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import troveManagerAbi from "../abi/TroveManager.json";
import xbrlTokenAbi from "../abi/XBRLToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import communityIssuanceAbi from "../abi/CommunityIssuance.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import stblTokenAbi from "../abi/STBLToken.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import lockupContractFactoryAbi from "../abi/LockupContractFactory.json";
import stblStakingAbi from "../abi/STBLStaking.json";
import multiTroveGetterAbi from "../abi/MultiTroveGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedTrovesAbi from "../abi/SortedTroves.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import gasPoolAbi from "../abi/GasPool.json";
import xbrlWethUnipoolAbi from "../abi/XBRLWETHUnipool.json";
import stblWethUnipoolAbi from "../abi/STBLWETHUnipool.json";
import iERC20Abi from "../abi/IERC20.json";
import erc20MockAbi from "../abi/ERC20Mock.json";

import {
  ActivePool,
  BorrowerOperations,
  TroveManager,
  XBRLToken,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  STBLToken,
  HintHelpers,
  LockupContractFactory,
  STBLStaking,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  GasPool,
  XBRLWETHUnipool,
  STBLWETHUnipool,
  ERC20Mock,
  IERC20
} from "../types";

import { EthersProvider, EthersSigner } from "./types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Ethers contract type
export type _TypeSafeContract<T> = Pick<
  T,
  {
    [P in keyof T]: BucketOfFunctions extends T[P] ? never : P;
  } extends {
    [_ in keyof T]: infer U;
  }
    ? U
    : never
>;

type EstimatedContractFunction<R = unknown, A extends unknown[] = unknown[], O = Overrides> = (
  overrides: O,
  adjustGas: (gas: BigNumber) => BigNumber,
  ...args: A
) => Promise<R>;

type CallOverridesArg = [overrides?: CallOverrides];

type TypedContract<T extends Contract, U, V> = _TypeSafeContract<T> &
  U &
  {
    [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<ContractTransaction>
      : never;
  } & {
    readonly callStatic: {
      [P in keyof V]: V[P] extends (...args: [...infer A, never]) => infer R
        ? (...args: [...A, ...CallOverridesArg]) => R
        : never;
    };

    readonly estimateGas: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<BigNumber>
        : never;
    };

    readonly populateTransaction: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<PopulatedTransaction>
        : never;
    };

    readonly estimateAndPopulate: {
      [P in keyof V]: V[P] extends (...args: [...infer A, infer O | undefined]) => unknown
        ? EstimatedContractFunction<PopulatedTransaction, A, O>
        : never;
    };
  };

const buildEstimatedFunctions = <T>(
  estimateFunctions: Record<string, ContractFunction<BigNumber>>,
  functions: Record<string, ContractFunction<T>>
): Record<string, EstimatedContractFunction<T>> =>
  Object.fromEntries(
    Object.keys(estimateFunctions).map(functionName => [
      functionName,
      async (overrides, adjustEstimate, ...args) => {
        if (overrides.gasLimit === undefined) {
          const estimatedGas = await estimateFunctions[functionName](...args, overrides);

          overrides = {
            ...overrides,
            gasLimit: adjustEstimate(estimatedGas)
          };
        }

        return functions[functionName](...args, overrides);
      }
    ])
  );

export class _StabilioContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: EthersSigner | EthersProvider
  ) {
    super(addressOrName, contractInterface, signerOrProvider);

    // this.estimateAndCall = buildEstimatedFunctions(this.estimateGas, this);
    this.estimateAndPopulate = buildEstimatedFunctions(this.estimateGas, this.populateTransaction);
  }

  extractEvents(logs: Log[], name: string): _TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

/** @internal */
export type _TypedStabilioContract<T = unknown, U = unknown> = TypedContract<_StabilioContract, T, U>;

/** @internal */
export interface _StabilioContracts {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  troveManager: TroveManager;
  xbrlToken: XBRLToken;
  collSurplusPool: CollSurplusPool;
  communityIssuance: CommunityIssuance;
  defaultPool: DefaultPool;
  stblToken: STBLToken;
  hintHelpers: HintHelpers;
  lockupContractFactory: LockupContractFactory;
  stblStaking: STBLStaking;
  multiTroveGetter: MultiTroveGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedTroves: SortedTroves;
  stabilityPool: StabilityPool;
  gasPool: GasPool;
  xbrlWethUnipool: XBRLWETHUnipool;
  stblWethUnipool: STBLWETHUnipool;
  xbrlWethUniToken: IERC20 | ERC20Mock;
  stblWethUniToken: IERC20 | ERC20Mock;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

/** @internal */
export const _uniTokenIsMock = (uniToken: IERC20 | ERC20Mock): uniToken is ERC20Mock =>
  "mint" in uniToken;

type StabilioContractsKey = keyof _StabilioContracts;

/** @internal */
export type _StabilioContractAddresses = Record<StabilioContractsKey, string>;

type StabilioContractAbis = Record<StabilioContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean, uniTokenIsMock: boolean): StabilioContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  troveManager: troveManagerAbi,
  xbrlToken: xbrlTokenAbi,
  communityIssuance: communityIssuanceAbi,
  defaultPool: defaultPoolAbi,
  stblToken: stblTokenAbi,
  hintHelpers: hintHelpersAbi,
  lockupContractFactory: lockupContractFactoryAbi,
  stblStaking: stblStakingAbi,
  multiTroveGetter: multiTroveGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedTroves: sortedTrovesAbi,
  stabilityPool: stabilityPoolAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi,
  xbrlWethUnipool: xbrlWethUnipoolAbi,
  stblWethUnipool: stblWethUnipoolAbi,
  xbrlWethUniToken: uniTokenIsMock ? erc20MockAbi : iERC20Abi,
  stblWethUniToken: uniTokenIsMock ? erc20MockAbi : iERC20Abi
});

const mapStabilioContracts = <T, U>(
  contracts: Record<StabilioContractsKey, T>,
  f: (t: T, key: StabilioContractsKey) => U
) =>
  Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as StabilioContractsKey)])
  ) as Record<StabilioContractsKey, U>;

/** @internal */
export interface _StabilioDeploymentJSON {
  readonly chainId: number;
  readonly addresses: _StabilioContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly startBlock: number;
  readonly bootstrapPeriod: number;
  readonly totalStabilityPoolSTBLReward: string;
  readonly xbrlWethLiquidityMiningSTBLRewardRate: string;
  readonly stblWethLiquidityMiningSTBLRewardRate: string;
  readonly _priceFeedIsTestnet: boolean;
  readonly _uniTokenIsMock: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: EthersSigner | EthersProvider,
  { addresses, _priceFeedIsTestnet, _uniTokenIsMock }: _StabilioDeploymentJSON
): _StabilioContracts => {
  const abi = getAbi(_priceFeedIsTestnet, _uniTokenIsMock);

  return mapStabilioContracts(
    addresses,
    (address, key) =>
      new _StabilioContract(address, abi[key], signerOrProvider) as _TypedStabilioContract
  ) as _StabilioContracts;
};
