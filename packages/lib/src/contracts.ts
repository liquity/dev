import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import cdpManagerAbi from "../abi/CDPManager.json";
import clvTokenAbi from "../abi/CLVToken.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
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

import type {
  ActivePool,
  BorrowerOperations,
  CDPManager,
  CLVToken,
  DefaultPool,
  MultiCDPGetter,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
} from "../types";

export interface LiquityContractAddresses {
  activePool: string;
  borrowerOperations: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  multiCDPgetter: string;
  poolManager: string;
  priceFeed: string;
  sortedCDPs: string;
  stabilityPool: string;
}

export interface LiquityContracts {
  [name: string]: Contract;

  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  cdpManager: CDPManager;
  clvToken: CLVToken;
  defaultPool: DefaultPool;
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
  activePool: new Contract(addresses.activePool, activePoolAbi, signerOrProvider) as ActivePool,
  borrowerOperations: new Contract(
    addresses.borrowerOperations,
    borrowerOperationsAbi,
    signerOrProvider
  ) as BorrowerOperations,
  cdpManager: new Contract(addresses.cdpManager, cdpManagerAbi, signerOrProvider) as CDPManager,
  clvToken: new Contract(addresses.clvToken, clvTokenAbi, signerOrProvider) as CLVToken,
  defaultPool: new Contract(addresses.defaultPool, defaultPoolAbi, signerOrProvider) as DefaultPool,
  multiCDPgetter: new Contract(
    addresses.multiCDPgetter,
    multiCDPgetterAbi,
    signerOrProvider
  ) as MultiCDPGetter,
  poolManager: new Contract(addresses.poolManager, poolManagerAbi, signerOrProvider) as PoolManager,
  priceFeed: new Contract(addresses.priceFeed, priceFeedAbi, signerOrProvider) as PriceFeed,
  sortedCDPs: new Contract(addresses.sortedCDPs, sortedCDPsAbi, signerOrProvider) as SortedCDPs,
  stabilityPool: new Contract(
    addresses.stabilityPool,
    stabilityPoolAbi,
    signerOrProvider
  ) as StabilityPool
});

export const DEV_CHAIN_ID = 17;

export type LiquityDeployment = {
  addresses: LiquityContractAddresses;
  version: string;
  deploymentDate: number;
};

export const deploymentOnNetwork: {
  [network: string]: LiquityDeployment;
  [chainId: number]: LiquityDeployment;
} = {
  dev,
  goerli,
  kovan,
  rinkeby,
  ropsten,

  3: ropsten,
  4: rinkeby,
  5: goerli,
  42: kovan,

  [DEV_CHAIN_ID]: dev
};
