import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { Provider, Log } from "@ethersproject/abstract-provider";
import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  PopulatedTransaction
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

export interface TypedLogDescription<T> extends Omit<LogDescription, "args"> {
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

export type TypedContract<T, U> = TypeSafeContract<T> &
  U & {
    // readonly estimateAndCall: {
    //   [P in keyof U]: U[P] extends (...args: [...infer A, infer O | undefined]) => Promise<infer R>
    //     ? EstimatedContractFunction<R, A, O>
    //     : never;
    // };

    readonly estimateAndPopulate: {
      [P in keyof U]: U[P] extends (...args: [...infer A, infer O | undefined]) => unknown
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
  // readonly estimateAndCall: Record<string, EstimatedContractFunction>;
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

  extractEvents(logs: Log[], name: string): TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

export type TypedLiquityContract<T = unknown> = TypedContract<LiquityContract, T>;

export interface LiquityContracts {
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

export const priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

export type LiquityContractsKey = keyof LiquityContracts;
export type LiquityContractAddresses = Record<LiquityContractsKey, string>;
export type LiquityContractAbis = Record<LiquityContractsKey, JsonFragment[]>;

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

export const connectToContracts = (
  addresses: LiquityContractAddresses,
  priceFeedIsTestnet: boolean,
  signerOrProvider: Signer | Provider
): LiquityContracts => {
  const abi = getAbi(priceFeedIsTestnet);

  return mapLiquityContracts(
    addresses,
    (address, key) =>
      new LiquityContract(address, abi[key], signerOrProvider) as TypedLiquityContract
  ) as LiquityContracts;
};

export const addressesOf = (contracts: LiquityContracts): LiquityContractAddresses =>
  mapLiquityContracts(
    contracts as Record<LiquityContractsKey, TypedLiquityContract>,
    contract => contract.address
  );

export type LiquityDeployment = {
  addresses: LiquityContractAddresses;
  priceFeedIsTestnet: boolean;
  version: string;
  deploymentDate: number;
};

export const DEV_CHAIN_ID = 17;

const dev = devOrNull as LiquityDeployment | null;

export const deploymentOnNetwork: {
  [network: string]: LiquityDeployment;
  [chainId: number]: LiquityDeployment;
} = {
  goerli,
  kovan,
  rinkeby,
  ropsten,

  3: ropsten,
  4: rinkeby,
  5: goerli,
  42: kovan,

  ...(dev !== null ? { [DEV_CHAIN_ID]: dev, dev } : {})
};
