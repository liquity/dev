import type Web3 from "web3";
import { Signer } from "ethers";
import { Provider } from "ethers/providers";

import { LiquityContractAddresses, LiquityContracts } from "../../src/contracts";
import { connectToContracts } from "../../src/contractConnector";

const waitForDeployment = async (web3: Web3, promisedContract: Promise<Truffle.ContractInstance>) => {
  const contract = await promisedContract;
  const receipt = await web3.eth.getTransactionReceipt(contract.transactionHash);

  //console.log(receipt.blockNumber);

  return contract;
}

const deployContracts = async (
  web3: Web3,
  artifacts: Truffle.Artifacts
): Promise<LiquityContractAddresses> => {
  // DeciMath is a library that needs to be linked into a couple other
  // contracts, so deploy it first
  const deciMath = await waitForDeployment(web3, artifacts.require("DeciMath").new());

  const CDPManager = artifacts.require("CDPManager");
  CDPManager.link(deciMath);
  const cdpManager = await waitForDeployment(web3, CDPManager.new());

  const PoolManager = artifacts.require("PoolManager");
  PoolManager.link(deciMath);
  const poolManager = await waitForDeployment(web3, PoolManager.new());

  // Rest need no linking
  const activePool = await waitForDeployment(web3, artifacts.require("ActivePool").new());
  const clvToken = await waitForDeployment(web3, artifacts.require("CLVToken").new());
  const defaultPool = await waitForDeployment(web3, artifacts.require("DefaultPool").new());
  const nameRegistry = await waitForDeployment(web3, artifacts.require("NameRegistry").new());
  const priceFeed = await waitForDeployment(web3, artifacts.require("PriceFeed").new());
  const sortedCDPs = await waitForDeployment(web3, artifacts.require("SortedCDPs").new());
  const stabilityPool = await waitForDeployment(web3, artifacts.require("StabilityPool").new());

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
  };
};
/*
const nameRegisterContracts = async (contracts: LiquityContracts) => {
  const nameRegistry = contracts.nameRegistry;
  await nameRegistry.registerContract("ActivePool", contracts.activePool.address);
  await nameRegistry.registerContract("CDPManager", contracts.cdpManager.address);
  await nameRegistry.registerContract("CLVToken", contracts.clvToken.address);
  await nameRegistry.registerContract("DefaultPool", contracts.defaultPool.address);
  await nameRegistry.registerContract("PoolManager", contracts.poolManager.address);
  await nameRegistry.registerContract("PriceFeed", contracts.priceFeed.address);
  await nameRegistry.registerContract("SortedCDPs", contracts.sortedCDPs.address);
  await nameRegistry.registerContract("StabilityPool", contracts.stabilityPool.address);
};
*/
const connectContracts = async (
  contracts: LiquityContracts,
  signerOrProvider: Signer | Provider
) => {
  let txCount: number | undefined;

  if (Signer.isSigner(signerOrProvider)) {
    txCount = await signerOrProvider.provider?.getTransactionCount(signerOrProvider.getAddress());
  }

  if (txCount === undefined) {
    throw new Error("Can't determine nonce");
  }

  const txs = await Promise.all(
    [
      (nonce: number) =>
        contracts.clvToken.setPoolManagerAddress(contracts.poolManager.address, { nonce }),
      (nonce: number) =>
        contracts.poolManager.setCDPManagerAddress(contracts.cdpManager.address, { nonce }),
      (nonce: number) => contracts.poolManager.setCLVToken(contracts.clvToken.address, { nonce }),
      (nonce: number) => contracts.poolManager.setPriceFeed(contracts.priceFeed.address, { nonce }),
      (nonce: number) =>
        contracts.poolManager.setStabilityPool(contracts.stabilityPool.address, { nonce }),
      (nonce: number) =>
        contracts.poolManager.setActivePool(contracts.activePool.address, { nonce }),
      (nonce: number) =>
        contracts.poolManager.setDefaultPool(contracts.defaultPool.address, { nonce }),
      (nonce: number) => contracts.sortedCDPs.setCDPManager(contracts.cdpManager.address, { nonce }),
      (nonce: number) =>
        contracts.priceFeed.setCDPManagerAddress(contracts.cdpManager.address, { nonce }),
      (nonce: number) => contracts.cdpManager.setCLVToken(contracts.clvToken.address, { nonce }),
      (nonce: number) => contracts.cdpManager.setSortedCDPs(contracts.sortedCDPs.address, { nonce }),
      (nonce: number) =>
        contracts.cdpManager.setPoolManager(contracts.poolManager.address, { nonce }),
      (nonce: number) => contracts.cdpManager.setPriceFeed(contracts.priceFeed.address, { nonce }),
      (nonce: number) =>
        contracts.stabilityPool.setPoolManagerAddress(contracts.poolManager.address, { nonce }),
      (nonce: number) =>
        contracts.stabilityPool.setActivePoolAddress(contracts.activePool.address, { nonce }),
      (nonce: number) =>
        contracts.stabilityPool.setDefaultPoolAddress(contracts.defaultPool.address, { nonce }),
      (nonce: number) =>
        contracts.activePool.setPoolManagerAddress(contracts.poolManager.address, { nonce }),
      (nonce: number) =>
        contracts.activePool.setStabilityPoolAddress(contracts.stabilityPool.address, { nonce }),
      (nonce: number) =>
        contracts.activePool.setDefaultPoolAddress(contracts.defaultPool.address, { nonce }),
      (nonce: number) =>
        contracts.defaultPool.setPoolManagerAddress(contracts.poolManager.address, { nonce }),
      (nonce: number) =>
        contracts.defaultPool.setStabilityPoolAddress(contracts.stabilityPool.address, { nonce }),
      (nonce: number) =>
        contracts.defaultPool.setActivePoolAddress(contracts.activePool.address, { nonce })
    ].map((tx, i) => tx(txCount! + i))
  );

  await Promise.all(txs.map(tx => tx.wait()));
};

export const deployAndSetupContracts = async (
  web3: Web3,
  artifacts: Truffle.Artifacts,
  signerOrProvider: Signer | Provider
): Promise<LiquityContracts> => {
  const addresses = await deployContracts(web3, artifacts);
  const contracts = connectToContracts(addresses, signerOrProvider);
  await connectContracts(contracts, signerOrProvider);
  //await nameRegisterContracts(contracts);

  return contracts;
};
