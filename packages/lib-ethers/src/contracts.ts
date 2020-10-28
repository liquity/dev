import { JsonFragment, LogDescription, Result } from "@ethersproject/abi";
import { Signer } from "@ethersproject/abstract-signer";
import { Provider, Log } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import cdpManagerAbi from "../abi/CDPManager.json";
import clvTokenAbi from "../abi/CLVToken.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import multiCDPgetterAbi from "../abi/MultiCDPGetter.json";
import poolManagerAbi from "../abi/PoolManager.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import sortedCDPsAbi from "../abi/SortedCDPs.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";

import dev from "../deployments/dev.json";
import goerli from "../deployments/goerli.json";
import kovan from "../deployments/kovan.json";
import rinkeby from "../deployments/rinkeby.json";
import ropsten from "../deployments/ropsten.json";

import {
  ActivePool,
  BorrowerOperations,
  CDPManager,
  CLVToken,
  DefaultPool,
  HintHelpers,
  MultiCDPGetter,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
} from "../types";

export const abi: { [name: string]: JsonFragment[] } = {
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  cdpManager: cdpManagerAbi,
  clvToken: clvTokenAbi,
  defaultPool: defaultPoolAbi,
  hintHelpers: hintHelpersAbi,
  multiCDPgetter: multiCDPgetterAbi,
  poolManager: poolManagerAbi,
  priceFeed: priceFeedAbi,
  sortedCDPs: sortedCDPsAbi,
  stabilityPool: stabilityPoolAbi
};

export interface TypedLogDescription<T> extends LogDescription {
  args: Result & T;
}

export class LiquityContract extends Contract {
  // Ethers defines any string-keyed property as any. Override this, because it's not typesafe.
  readonly [name: string]: unknown;

  extractEvents(logs: Log[], name: string) {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

export interface LiquityContractAddresses {
  activePool: string;
  borrowerOperations: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  hintHelpers: string;
  multiCDPgetter: string;
  poolManager: string;
  priceFeed: string;
  sortedCDPs: string;
  stabilityPool: string;
}

export interface LiquityContracts {
  [name: string]: LiquityContract;

  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  cdpManager: CDPManager;
  clvToken: CLVToken;
  defaultPool: DefaultPool;
  hintHelpers: HintHelpers;
  multiCDPgetter: MultiCDPGetter;
  poolManager: PoolManager;
  priceFeed: PriceFeed;
  sortedCDPs: SortedCDPs;
  stabilityPool: StabilityPool;
}

export const addressesOf = (contracts: LiquityContracts): LiquityContractAddresses => ({
  activePool: contracts.activePool.address,
  borrowerOperations: contracts.borrowerOperations.address,
  cdpManager: contracts.cdpManager.address,
  clvToken: contracts.clvToken.address,
  defaultPool: contracts.defaultPool.address,
  hintHelpers: contracts.hintHelpers.address,
  multiCDPgetter: contracts.multiCDPgetter.address,
  poolManager: contracts.poolManager.address,
  priceFeed: contracts.priceFeed.address,
  sortedCDPs: contracts.sortedCDPs.address,
  stabilityPool: contracts.stabilityPool.address
});

export const connectToContracts = (
  addresses: LiquityContractAddresses,
  signerOrProvider: Signer | Provider
): LiquityContracts => ({
  activePool: new LiquityContract(
    addresses.activePool,
    activePoolAbi,
    signerOrProvider
  ) as ActivePool,
  borrowerOperations: new LiquityContract(
    addresses.borrowerOperations,
    borrowerOperationsAbi,
    signerOrProvider
  ) as BorrowerOperations,

  cdpManager: new LiquityContract(
    addresses.cdpManager,
    cdpManagerAbi,
    signerOrProvider
  ) as CDPManager,

  clvToken: new LiquityContract(addresses.clvToken, clvTokenAbi, signerOrProvider) as CLVToken,

  defaultPool: new LiquityContract(
    addresses.defaultPool,
    defaultPoolAbi,
    signerOrProvider
  ) as DefaultPool,

  hintHelpers: new LiquityContract(
    addresses.hintHelpers,
    hintHelpersAbi,
    signerOrProvider
  ) as HintHelpers,

  multiCDPgetter: new LiquityContract(
    addresses.multiCDPgetter,
    multiCDPgetterAbi,
    signerOrProvider
  ) as MultiCDPGetter,

  poolManager: new LiquityContract(
    addresses.poolManager,
    poolManagerAbi,
    signerOrProvider
  ) as PoolManager,

  priceFeed: new LiquityContract(addresses.priceFeed, priceFeedAbi, signerOrProvider) as PriceFeed,

  sortedCDPs: new LiquityContract(
    addresses.sortedCDPs,
    sortedCDPsAbi,
    signerOrProvider
  ) as SortedCDPs,

  stabilityPool: new LiquityContract(
    addresses.stabilityPool,
    stabilityPoolAbi,
    signerOrProvider
  ) as StabilityPool
});

export type LiquityDeployment = {
  addresses: LiquityContractAddresses;
  version: string;
  deploymentDate: number;
  abiHash: string;
};

export const DEV_CHAIN_ID = 17;

type DevDeployment = {
  dev: LiquityDeployment;
  [DEV_CHAIN_ID]: LiquityDeployment;
};

const devDeployment: DevDeployment | {} =
  dev !== null
    ? {
        dev,
        [DEV_CHAIN_ID]: dev
      }
    : {};

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

  ...devDeployment
};
