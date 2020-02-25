import { TruffleEnvironmentArtifacts } from "@nomiclabs/buidler-truffle5/src/artifacts";

import { Signer } from "ethers";
import { Provider } from "ethers/providers";

import { LiquityContractAddresses, LiquityContracts } from "../../src/contracts";
import { connectToContracts } from "../../src/contractConnector";

const deployContracts = async (
  artifacts: TruffleEnvironmentArtifacts
): Promise<LiquityContractAddresses> => {
  // DeciMath is a library that needs to be linked into a couple other
  // contracts, so deploy it first
  const deciMath = await artifacts.require("deciMath").new();

  const CDPManager = artifacts.require("CDPManager");
  CDPManager.link(deciMath);
  const cdpManager = await CDPManager.new();

  const PoolManager = artifacts.require("PoolManager");
  PoolManager.link(deciMath);
  const poolManager = await PoolManager.new();

  // Rest need no linking
  const activePool = await artifacts.require("ActivePool").new();
  const clvToken = await artifacts.require("CLVToken").new();
  const defaultPool = await artifacts.require("DefaultPool").new();
  const nameRegistry = await artifacts.require("NameRegistry").new();
  const priceFeed = await artifacts.require("PriceFeed").new();
  const sortedCDPs = await artifacts.require("SortedCDPs").new();
  const stabilityPool = await artifacts.require("StabilityPool").new();

  return {
    activePool: activePool.address,
    cdpManager: cdpManager.address,
    clvToken: clvToken.address,
    defaultPool: defaultPool.address,
    nameRegistry: nameRegistry.address,
    poolManager: poolManager.address,
    priceFeed: priceFeed.address,
    sortedCDPs: sortedCDPs.address,
    stabilityPool: stabilityPool.address
  }
}

const nameRegisterContracts = async (
  contracts: LiquityContracts
) => {
  const nameRegistry = contracts.nameRegistry;
  await nameRegistry.registerContract("ActivePool", contracts.activePool.address);
  await nameRegistry.registerContract("CDPManager", contracts.cdpManager.address);
  await nameRegistry.registerContract("CLVToken", contracts.clvToken.address);
  await nameRegistry.registerContract("DefaultPool", contracts.defaultPool.address);
  await nameRegistry.registerContract("PoolManager", contracts.poolManager.address);
  await nameRegistry.registerContract("PriceFeed", contracts.priceFeed.address);
  await nameRegistry.registerContract("SortedCDPs", contracts.sortedCDPs.address);
  await nameRegistry.registerContract("StabilityPool", contracts.stabilityPool.address);
}

const connectContracts = async (
  contracts: LiquityContracts
) => {
  await contracts.clvToken.setPoolManagerAddress(contracts.poolManager.address);
  await contracts.poolManager.setCDPManagerAddress(contracts.cdpManager.address);
  await contracts.poolManager.setCLVToken(contracts.clvToken.address);
  await contracts.poolManager.setPriceFeed(contracts.priceFeed.address);
  await contracts.poolManager.setStabilityPool(contracts.stabilityPool.address);
  await contracts.poolManager.setActivePool(contracts.activePool.address);
  await contracts.poolManager.setDefaultPool(contracts.defaultPool.address);
  await contracts.sortedCDPs.setCDPManager(contracts.cdpManager.address);
  await contracts.priceFeed.setCDPManagerAddress(contracts.cdpManager.address);
  await contracts.cdpManager.setCLVToken(contracts.clvToken.address);
  await contracts.cdpManager.setSortedCDPs(contracts.sortedCDPs.address);
  await contracts.cdpManager.setPoolManager(contracts.poolManager.address);
  await contracts.cdpManager.setPriceFeed(contracts.priceFeed.address);
  await contracts.stabilityPool.setPoolManagerAddress(contracts.poolManager.address);
  await contracts.stabilityPool.setActivePoolAddress(contracts.activePool.address);
  await contracts.stabilityPool.setDefaultPoolAddress(contracts.defaultPool.address);
  await contracts.activePool.setPoolManagerAddress(contracts.poolManager.address);
  await contracts.activePool.setStabilityPoolAddress(contracts.stabilityPool.address);
  await contracts.activePool.setDefaultPoolAddress(contracts.defaultPool.address);
  await contracts.defaultPool.setPoolManagerAddress(contracts.poolManager.address);
  await contracts.defaultPool.setStabilityPoolAddress(contracts.stabilityPool.address);
  await contracts.defaultPool.setActivePoolAddress(contracts.activePool.address);
}

export const deployAndSetupContracts = async (
  artifacts: TruffleEnvironmentArtifacts,
  signerOrProvider: Signer | Provider
): Promise<LiquityContracts> => {
  const addresses = await deployContracts(artifacts);
  const contracts = connectToContracts(addresses, signerOrProvider);
  await connectContracts(contracts);
  await nameRegisterContracts(contracts);

  return contracts;
}
