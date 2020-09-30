import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";

import { LiquityContractAddresses, LiquityContracts, connectToContracts } from "../src/contracts";

let silent = true;

const ZERO_ADDRESS = '0x' + '0'.repeat(40)

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

    nonce => poolManager.setAddresses(
      borrowerOperations.address,
      cdpManager.address,
      priceFeed.address,
      clvToken.address,
      stabilityPool.address,
      activePool.address,
      defaultPool.address,
      { ...overrides, nonce }
    ),

    nonce => sortedCDPs.setParams(
      10000000,
      cdpManager.address,
      borrowerOperations.address,
      { ...overrides, nonce }
    ),

    nonce => priceFeed.setAddresses(
      cdpManager.address,
      poolManager.address,
      ZERO_ADDRESS,
      ZERO_ADDRESS,
      { ...overrides, nonce }
    ),

    nonce => cdpManager.setAddresses(
      borrowerOperations.address,
      poolManager.address,
      activePool.address,
      defaultPool.address,
      stabilityPool.address,
      priceFeed.address,
      clvToken.address,
      sortedCDPs.address,
      { ...overrides, nonce }
    ),

    nonce => borrowerOperations.setAddresses(
      cdpManager.address,
      poolManager.address,
      activePool.address,
      defaultPool.address,
      priceFeed.address,
      sortedCDPs.address,
      { ...overrides, nonce }
    ),

    nonce => stabilityPool.setAddresses(
      poolManager.address,
      activePool.address,
      defaultPool.address,
      { ...overrides, nonce }
    ),

    nonce => activePool.setAddresses(
      poolManager.address,
      cdpManager.address,
      defaultPool.address,
      stabilityPool.address,
      { ...overrides, nonce }
    ),

    nonce => defaultPool.setAddresses(
      poolManager.address,
      activePool.address,
      stabilityPool.address,
      { ...overrides, nonce }
    ),

    nonce => hintHelpers.setAddresses(
      priceFeed.address,
      sortedCDPs.address,
      cdpManager.address,
      { ...overrides, nonce }
    ),
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
