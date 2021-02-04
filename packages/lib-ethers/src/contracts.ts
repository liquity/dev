import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { Provider, Log } from "@ethersproject/abstract-provider";
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
import lusdTokenAbi from "../abi/LUSDToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import communityIssuanceAbi from "../abi/CommunityIssuance.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import lqtyTokenAbi from "../abi/LQTYToken.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import lockupContractFactoryAbi from "../abi/LockupContractFactory.json";
import lqtyStakingAbi from "../abi/LQTYStaking.json";
import multiTroveGetterAbi from "../abi/MultiTroveGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedTrovesAbi from "../abi/SortedTroves.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import gasPoolAbi from "../abi/GasPool.json";

import devOrNull from "../deployments/dev.json";
import goerli from "../deployments/goerli.json";
import kovan from "../deployments/kovan.json";
import rinkeby from "../deployments/rinkeby.json";
import ropsten from "../deployments/ropsten.json";

import {
  ActivePool,
  BorrowerOperations,
  TroveManager,
  LUSDToken,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  LQTYToken,
  HintHelpers,
  LockupContractFactory,
  LQTYStaking,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  GasPool
} from "../types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Ethers contract type
type TypeSafeContract<T> = Pick<
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

type TypedContract<T, U, V> = TypeSafeContract<T> &
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

class LiquityContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: Signer | Provider
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
export type _TypedLiquityContract<T = unknown, U = unknown> = TypedContract<LiquityContract, T, U>;

/** @internal */
export interface _LiquityContracts {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  troveManager: TroveManager;
  lusdToken: LUSDToken;
  collSurplusPool: CollSurplusPool;
  communityIssuance: CommunityIssuance;
  defaultPool: DefaultPool;
  lqtyToken: LQTYToken;
  hintHelpers: HintHelpers;
  lockupContractFactory: LockupContractFactory;
  lqtyStaking: LQTYStaking;
  multiTroveGetter: MultiTroveGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedTroves: SortedTroves;
  stabilityPool: StabilityPool;
  gasPool: GasPool;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

type LiquityContractsKey = keyof _LiquityContracts;

/** @internal */
export type _LiquityContractAddresses = Record<LiquityContractsKey, string>;

type LiquityContractAbis = Record<LiquityContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean): LiquityContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  troveManager: troveManagerAbi,
  lusdToken: lusdTokenAbi,
  communityIssuance: communityIssuanceAbi,
  defaultPool: defaultPoolAbi,
  lqtyToken: lqtyTokenAbi,
  hintHelpers: hintHelpersAbi,
  lockupContractFactory: lockupContractFactoryAbi,
  lqtyStaking: lqtyStakingAbi,
  multiTroveGetter: multiTroveGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedTroves: sortedTrovesAbi,
  stabilityPool: stabilityPoolAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi
});

const mapLiquityContracts = <T, U>(
  contracts: Record<LiquityContractsKey, T>,
  f: (t: T, key: LiquityContractsKey) => U
) =>
  Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as LiquityContractsKey)])
  ) as Record<LiquityContractsKey, U>;

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

export interface LiquityConnection {
  readonly signerOrProvider: Signer | Provider;

  readonly addresses: Record<string, string>;
  readonly version: string;
  readonly deploymentDate: number;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _LiquityConnection extends LiquityConnection {
  readonly addresses: _LiquityContractAddresses;
  readonly _contracts: _LiquityContracts;
}

/** @internal */
export interface _LiquityDeploymentJSON {
  readonly addresses: _LiquityContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly _priceFeedIsTestnet: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: Signer | Provider,
  { addresses, _priceFeedIsTestnet }: _LiquityDeploymentJSON
): _LiquityContracts => {
  const abi = getAbi(_priceFeedIsTestnet);

  return mapLiquityContracts(
    addresses,
    (address, key) =>
      new LiquityContract(address, abi[key], signerOrProvider) as _TypedLiquityContract
  ) as _LiquityContracts;
};

const dev = devOrNull as _LiquityDeploymentJSON | null;

const deployments: {
  [network: string]: _LiquityDeploymentJSON;
  [chainId: number]: _LiquityDeploymentJSON;
} = {
  goerli,
  kovan,
  rinkeby,
  ropsten,

  3: ropsten,
  4: rinkeby,
  5: goerli,
  42: kovan,

  ...(dev !== null ? { [17]: dev, dev } : {})
};

const connectedDeploymentFrom = (
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: Signer | Provider,
  _contracts: _LiquityContracts
): _LiquityConnection =>
  branded({
    ...deployment,
    signerOrProvider,
    _contracts
  });

/** @internal */
export const _getContracts = (connection: LiquityConnection): _LiquityContracts =>
  (connection as _LiquityConnection)._contracts;

export class UnsupportedNetworkError extends Error {
  readonly unsupportedNetwork: string | number;

  /** @internal */
  constructor(unsupportedNetwork: string | number) {
    super(`Unsupported network ${unsupportedNetwork}`);
    this.name = "UnsupportedNetworkError";
    this.unsupportedNetwork = unsupportedNetwork;
  }
}

/** @internal */
export const _connectToDeployment = (
  deployment: _LiquityDeploymentJSON,
  signerOrProvider: Signer | Provider
): LiquityConnection =>
  connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment)
  );

export function connectToLiquity(
  signerOrProvider: Signer | Provider,
  network: string | number = "mainnet"
): LiquityConnection {
  if (!(network in deployments)) {
    throw new UnsupportedNetworkError(network);
  }

  const deployment = deployments[network];

  return connectedDeploymentFrom(
    deployment,
    signerOrProvider,
    _connectToContracts(signerOrProvider, deployment)
  );
}
