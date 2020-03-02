import { ActivePool } from "../types/ActivePool";
import { CDPManager } from "../types/CDPManager";
import { CLVToken } from "../types/CLVToken";
import { DefaultPool } from "../types/DefaultPool";
import { NameRegistry } from "../types/NameRegistry";
import { PoolManager } from "../types/PoolManager";
import { PriceFeed } from "../types/PriceFeed";
import { SortedCDPs } from "../types/SortedCDPs";
import { StabilityPool } from "../types/StabilityPool";

export interface LiquityContractAddresses {
  activePool: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  nameRegistry: string;
  poolManager: string;
  priceFeed: string;
  sortedCDPs: string;
  stabilityPool: string;
}

export interface LiquityContracts {
  activePool: ActivePool;
  cdpManager: CDPManager;
  clvToken: CLVToken;
  defaultPool: DefaultPool;
  nameRegistry: NameRegistry;
  poolManager: PoolManager;
  priceFeed: PriceFeed;
  sortedCDPs: SortedCDPs;
  stabilityPool: StabilityPool;
}

export const addressesOf = (contracts: LiquityContracts): LiquityContractAddresses => ({
  activePool: contracts.activePool.address,
  cdpManager: contracts.cdpManager.address,
  clvToken: contracts.clvToken.address,
  defaultPool: contracts.defaultPool.address,
  nameRegistry: contracts.nameRegistry.address,
  poolManager: contracts.poolManager.address,
  priceFeed: contracts.priceFeed.address,
  sortedCDPs: contracts.sortedCDPs.address,
  stabilityPool: contracts.stabilityPool.address
});
