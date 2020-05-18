import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory } from "@ethersproject/contracts";

import { LiquityContractAddresses, LiquityContracts, connectToContracts } from "../src/contracts";

let silent = true;

export const setSilent = (s: boolean) => {
  silent = s;
};

const deployContract = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: any[]
) => {
  silent || console.log(`Deploying ${contractName} ...`);
  const contract = await (await getContractFactory(contractName, deployer)).deploy(...args);

  silent || console.log(`Waiting for transaction ${contract.deployTransaction.hash} ...`);
  const receipt = await contract.deployTransaction.wait();

  if (!silent) {
    console.log({
      contractAddress: contract.address,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toNumber()
    });
    console.log();
  }

  return contract.address;
};

const deployContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>
): Promise<LiquityContractAddresses> => {
  const addresses = {
    activePool: await deployContract(deployer, getContractFactory, "ActivePool"),
    borrowerOperations: await deployContract(deployer, getContractFactory, "BorrowerOperations"),
    cdpManager: await deployContract(deployer, getContractFactory, "CDPManager"),
    clvToken: await deployContract(deployer, getContractFactory, "CLVToken"),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool"),
    poolManager: await deployContract(deployer, getContractFactory, "PoolManager"),
    priceFeed: await deployContract(deployer, getContractFactory, "PriceFeed"),
    sortedCDPs: await deployContract(deployer, getContractFactory, "SortedCDPs"),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool")
  };

  return {
    ...addresses,

    multiCDPgetter: await deployContract(
      deployer,
      getContractFactory,
      "MultiCDPGetter",
      addresses.cdpManager,
      addresses.sortedCDPs
    )
  };
};

const connectContracts = async (
  {
    activePool,
    borrowerOperations,
    cdpManager,
    clvToken,
    defaultPool,
    poolManager,
    priceFeed,
    sortedCDPs,
    stabilityPool
  }: LiquityContracts,
  deployer: Signer
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  const txCount = await deployer.provider.getTransactionCount(deployer.getAddress());

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce => clvToken.setPoolManagerAddress(poolManager.address, { nonce }),
    nonce => poolManager.setBorrowerOperations(borrowerOperations.address, { nonce }),
    nonce => poolManager.setCDPManagerAddress(cdpManager.address, { nonce }),
    nonce => poolManager.setCLVToken(clvToken.address, { nonce }),
    nonce => poolManager.setPriceFeed(priceFeed.address, { nonce }),
    nonce => poolManager.setStabilityPool(stabilityPool.address, { nonce }),
    nonce => poolManager.setActivePool(activePool.address, { nonce }),
    nonce => poolManager.setDefaultPool(defaultPool.address, { nonce }),
    nonce => sortedCDPs.setCDPManager(cdpManager.address, { nonce }),
    nonce => priceFeed.setCDPManagerAddress(cdpManager.address, { nonce }),
    nonce => cdpManager.setCLVToken(clvToken.address, { nonce }),
    nonce => cdpManager.setSortedCDPs(sortedCDPs.address, { nonce }),
    nonce => cdpManager.setPoolManager(poolManager.address, { nonce }),
    nonce => cdpManager.setPriceFeed(priceFeed.address, { nonce }),
    nonce => cdpManager.setActivePool(activePool.address, { nonce }),
    nonce => cdpManager.setDefaultPool(defaultPool.address, { nonce }),
    nonce => cdpManager.setStabilityPool(stabilityPool.address, { nonce }),
    nonce => cdpManager.setBorrowerOperations(borrowerOperations.address, { nonce }),
    nonce => borrowerOperations.setSortedCDPs(sortedCDPs.address, { nonce }),
    nonce => borrowerOperations.setPoolManager(poolManager.address, { nonce }),
    nonce => borrowerOperations.setPriceFeed(priceFeed.address, { nonce }),
    nonce => borrowerOperations.setActivePool(activePool.address, { nonce }),
    nonce => borrowerOperations.setDefaultPool(defaultPool.address, { nonce }),
    nonce => borrowerOperations.setCDPManager(cdpManager.address, { nonce }),
    nonce => stabilityPool.setPoolManagerAddress(poolManager.address, { nonce }),
    nonce => stabilityPool.setActivePoolAddress(activePool.address, { nonce }),
    nonce => stabilityPool.setDefaultPoolAddress(defaultPool.address, { nonce }),
    nonce => activePool.setPoolManagerAddress(poolManager.address, { nonce }),
    nonce => activePool.setStabilityPoolAddress(stabilityPool.address, { nonce }),
    nonce => activePool.setDefaultPoolAddress(defaultPool.address, { nonce }),
    nonce => defaultPool.setPoolManagerAddress(poolManager.address, { nonce }),
    nonce => defaultPool.setStabilityPoolAddress(stabilityPool.address, { nonce }),
    nonce => defaultPool.setActivePoolAddress(activePool.address, { nonce })
  ];

  const txs = await Promise.all(connections.map((connect, i) => connect(txCount + i)));

  let i = 0;
  await Promise.all(txs.map(tx => tx.wait().then(() => silent || console.log(`Connected ${++i}`))));
};

export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>
): Promise<LiquityContracts> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  silent || (console.log("Deploying contracts..."), console.log());
  const addresses = await deployContracts(deployer, getContractFactory);
  const contracts = connectToContracts(addresses, deployer);
  silent || console.log("Connecting contracts...");
  await connectContracts(contracts, deployer);

  return contracts;
};
