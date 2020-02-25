import { Contract } from "ethers";

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
  [contractName: string]: Contract;

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
