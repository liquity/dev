import { Signer } from "ethers";
import { Provider } from "ethers/providers";

import { ActivePoolFactory } from "../types/ActivePoolFactory";
import { CDPManagerFactory } from "../types/CDPManagerFactory";
import { CLVTokenFactory } from "../types/CLVTokenFactory";
import { DefaultPoolFactory } from "../types/DefaultPoolFactory";
import { NameRegistryFactory } from "../types/NameRegistryFactory";
import { PoolManagerFactory } from "../types/PoolManagerFactory";
import { PriceFeedFactory } from "../types/PriceFeedFactory";
import { SortedCDPsFactory } from "../types/SortedCDPsFactory";
import { StabilityPoolFactory } from "../types/StabilityPoolFactory";

import { LiquityContractAddresses, LiquityContracts } from "./contracts";

export const connectToContracts = (
  addresses: LiquityContractAddresses,
  signerOrProvider: Signer | Provider
): LiquityContracts => ({
  activePool: ActivePoolFactory.connect(addresses.activePool, signerOrProvider),
  cdpManager: CDPManagerFactory.connect(addresses.cdpManager, signerOrProvider),
  clvToken: CLVTokenFactory.connect(addresses.clvToken, signerOrProvider),
  defaultPool: DefaultPoolFactory.connect(addresses.defaultPool, signerOrProvider),
  nameRegistry: NameRegistryFactory.connect(addresses.nameRegistry, signerOrProvider),
  poolManager: PoolManagerFactory.connect(addresses.poolManager, signerOrProvider),
  priceFeed: PriceFeedFactory.connect(addresses.priceFeed, signerOrProvider),
  sortedCDPs: SortedCDPsFactory.connect(addresses.sortedCDPs, signerOrProvider),
  stabilityPool: StabilityPoolFactory.connect(addresses.stabilityPool, signerOrProvider)
});

const getContractAddressesFromNameRegistry = async (
  nameRegistryAddress: string,
  signerOrProvider: Signer | Provider
): Promise<LiquityContractAddresses> => {
  const nameRegistry = NameRegistryFactory.connect(nameRegistryAddress, signerOrProvider);
  return {
    nameRegistry: nameRegistryAddress,
    activePool: await nameRegistry.getAddress("ActivePool"),
    cdpManager: await nameRegistry.getAddress("CDPManager"),
    clvToken: await nameRegistry.getAddress("CLVToken"),
    defaultPool: await nameRegistry.getAddress("DefaultPool"),
    poolManager: await nameRegistry.getAddress("PoolManager"),
    priceFeed: await nameRegistry.getAddress("PriceFeed"),
    sortedCDPs: await nameRegistry.getAddress("SortedCDPs"),
    stabilityPool: await nameRegistry.getAddress("StabilityPool")
  }
}

export const getContractsFromNameRegistry = async (
  nameRegistryAddress: string,
  signerOrProvider: Signer | Provider
): Promise<LiquityContracts> => {
  const addresses = await getContractAddressesFromNameRegistry(nameRegistryAddress, signerOrProvider);
  return connectToContracts(addresses, signerOrProvider);
}
