import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";

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
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
): Promise<LiquityContractAddresses> => {
  const addresses = {
    activePool: await deployContract(deployer, getContractFactory, "ActivePool", { ...overrides }),
    borrowerOperations: await deployContract(deployer, getContractFactory, "BorrowerOperations", {
      ...overrides
    }),
    cdpManager: await deployContract(deployer, getContractFactory, "CDPManager", { ...overrides }),
    clvToken: await deployContract(deployer, getContractFactory, "CLVToken", { ...overrides }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
    poolManager: await deployContract(deployer, getContractFactory, "PoolManager", { ...overrides }),
    priceFeed: await deployContract(deployer, getContractFactory, "PriceFeed", { ...overrides }),
    sizeList_18orLess: await deployContract(deployer, getContractFactory, "SortedCDPs", {
      ...overrides
    }),
    sizeList_19orGreater: await deployContract(deployer, getContractFactory, "SortedCDPs", {
      ...overrides
    }),
    sortedCDPs: await deployContract(deployer, getContractFactory, "SortedCDPs", { ...overrides }),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    })
  };

  return {
    ...addresses,

    multiCDPgetter: await deployContract(
      deployer,
      getContractFactory,
      "MultiCDPGetter",
      addresses.cdpManager,
      addresses.sortedCDPs,
      { ...overrides }
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
    hintHelpers,
    poolManager,
    priceFeed,
    sizeList_18orLess,
    sizeList_19orGreater,
    sortedCDPs,
    stabilityPool
  }: LiquityContracts,
  deployer: Signer,
  overrides?: Overrides
) => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  const txCount = await deployer.provider.getTransactionCount(deployer.getAddress());

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce => clvToken.setPoolManagerAddress(poolManager.address, { ...overrides, nonce }),

    nonce => poolManager.setBorrowerOperations(borrowerOperations.address, { ...overrides, nonce }),
    nonce => poolManager.setCDPManager(cdpManager.address, { ...overrides, nonce }),
    nonce => poolManager.setCLVToken(clvToken.address, { ...overrides, nonce }),
    nonce => poolManager.setPriceFeed(priceFeed.address, { ...overrides, nonce }),
    nonce => poolManager.setStabilityPool(stabilityPool.address, { ...overrides, nonce }),
    nonce => poolManager.setActivePool(activePool.address, { ...overrides, nonce }),
    nonce => poolManager.setDefaultPool(defaultPool.address, { ...overrides, nonce }),

    nonce => sortedCDPs.setCDPManager(cdpManager.address, { ...overrides, nonce }),
    nonce => sortedCDPs.setBorrowerOperations(borrowerOperations.address, { ...overrides, nonce }),

    nonce => sizeList_18orLess.setCDPManager(cdpManager.address, { ...overrides, nonce }),
    nonce =>
      sizeList_18orLess.setBorrowerOperations(borrowerOperations.address, { ...overrides, nonce }),
    nonce => sizeList_19orGreater.setCDPManager(cdpManager.address, { ...overrides, nonce }),
    nonce =>
      sizeList_19orGreater.setBorrowerOperations(borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce => priceFeed.setCDPManagerAddress(cdpManager.address, { ...overrides, nonce }),

    nonce => cdpManager.setSortedCDPs(sortedCDPs.address, { ...overrides, nonce }),
    nonce => cdpManager.setPoolManager(poolManager.address, { ...overrides, nonce }),
    nonce => cdpManager.setPriceFeed(priceFeed.address, { ...overrides, nonce }),
    nonce => cdpManager.setCLVToken(clvToken.address, { ...overrides, nonce }),
    nonce => cdpManager.setActivePool(activePool.address, { ...overrides, nonce }),
    nonce => cdpManager.setDefaultPool(defaultPool.address, { ...overrides, nonce }),
    nonce => cdpManager.setStabilityPool(stabilityPool.address, { ...overrides, nonce }),
    nonce => cdpManager.setBorrowerOperations(borrowerOperations.address, { ...overrides, nonce }),

    nonce => cdpManager.setSizeList(18, sizeList_18orLess.address, { ...overrides, nonce }),
    nonce => cdpManager.setSizeList(19, sizeList_19orGreater.address, { ...overrides, nonce }),

    nonce => borrowerOperations.setSortedCDPs(sortedCDPs.address, { ...overrides, nonce }),
    nonce => borrowerOperations.setPoolManager(poolManager.address, { ...overrides, nonce }),
    nonce => borrowerOperations.setPriceFeed(priceFeed.address, { ...overrides, nonce }),
    nonce => borrowerOperations.setActivePool(activePool.address, { ...overrides, nonce }),
    nonce => borrowerOperations.setDefaultPool(defaultPool.address, { ...overrides, nonce }),
    nonce => borrowerOperations.setCDPManager(cdpManager.address, { ...overrides, nonce }),

    nonce => stabilityPool.setPoolManagerAddress(poolManager.address, { ...overrides, nonce }),
    nonce => stabilityPool.setActivePoolAddress(activePool.address, { ...overrides, nonce }),
    nonce => stabilityPool.setDefaultPoolAddress(defaultPool.address, { ...overrides, nonce }),

    nonce => activePool.setPoolManagerAddress(poolManager.address, { ...overrides, nonce }),
    nonce => activePool.setCDPManagerAddress(cdpManager.address, { ...overrides, nonce }),
    nonce => activePool.setStabilityPoolAddress(stabilityPool.address, { ...overrides, nonce }),
    nonce => activePool.setDefaultPoolAddress(defaultPool.address, { ...overrides, nonce }),

    nonce => defaultPool.setPoolManagerAddress(poolManager.address, { ...overrides, nonce }),
    nonce => defaultPool.setStabilityPoolAddress(stabilityPool.address, { ...overrides, nonce }),
    nonce => defaultPool.setActivePoolAddress(activePool.address, { ...overrides, nonce }),

    nonce => hintHelpers.setPriceFeed(priceFeed.address, { ...overrides, nonce }),
    nonce => hintHelpers.setCDPManager(cdpManager.address, { ...overrides, nonce }),
    nonce => hintHelpers.setSortedCDPs(sortedCDPs.address, { ...overrides, nonce })
  ];

  const txs = await Promise.all(connections.map((connect, i) => connect(txCount + i)));

  let i = 0;
  await Promise.all(txs.map(tx => tx.wait().then(() => silent || console.log(`Connected ${++i}`))));
};

export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
): Promise<LiquityContracts> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  silent || (console.log("Deploying contracts..."), console.log());
  const addresses = await deployContracts(deployer, getContractFactory, overrides);
  const contracts = connectToContracts(addresses, deployer);
  silent || console.log("Connecting contracts...");
  await connectContracts(contracts, deployer, overrides);

  return contracts;
};
