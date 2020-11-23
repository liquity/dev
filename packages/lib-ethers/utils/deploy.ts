import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";
import { AddressZero } from "@ethersproject/constants";

import { LiquityContractAddresses, LiquityContracts, connectToContracts } from "../src/contracts";

let silent = true;

const ropstenAggregator = "0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507";

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
    communityIssuance: await deployContract(deployer, getContractFactory, "CommunityIssuance", {
      ...overrides
    }),
    defaultPool: await deployContract(deployer, getContractFactory, "DefaultPool", { ...overrides }),
    hintHelpers: await deployContract(deployer, getContractFactory, "HintHelpers", { ...overrides }),
    lockupContractFactory: await deployContract(
      deployer,
      getContractFactory,
      "LockupContractFactory",
      { ...overrides }
    ),
    lqtyStaking: await deployContract(deployer, getContractFactory, "LQTYStaking", { ...overrides }),
    priceFeed: await deployContract(deployer, getContractFactory, "PriceFeed", { ...overrides }),
    sortedCDPs: await deployContract(deployer, getContractFactory, "SortedCDPs", { ...overrides }),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    })
  };

  return {
    ...addresses,

    growthToken: await deployContract(
      deployer,
      getContractFactory,
      "GrowthToken",
      addresses.communityIssuance,
      addresses.lockupContractFactory,
      { ...overrides }
    ),

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
    communityIssuance,
    defaultPool,
    growthToken,
    hintHelpers,
    lockupContractFactory,
    lqtyStaking,
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
  const network = await deployer.provider.getNetwork();

  const connections: ((nonce: number) => Promise<ContractTransaction>)[] = [
    nonce =>
      clvToken.setAddresses(borrowerOperations.address, cdpManager.address, stabilityPool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      sortedCDPs.setParams(1e6, cdpManager.address, borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      priceFeed.setAddresses(
        cdpManager.address,
        AddressZero,
        network.name === "ropsten" ? ropstenAggregator : AddressZero,
        {
          ...overrides,
          nonce
        }
      ),

    nonce =>
      cdpManager.setAddresses(
        borrowerOperations.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        priceFeed.address,
        clvToken.address,
        sortedCDPs.address,
        lqtyStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      borrowerOperations.setAddresses(
        cdpManager.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        priceFeed.address,
        sortedCDPs.address,
        clvToken.address,
        lqtyStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      stabilityPool.setAddresses(
        borrowerOperations.address,
        cdpManager.address,
        activePool.address,
        clvToken.address,
        communityIssuance.address,
        { ...overrides, nonce }
      ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        cdpManager.address,
        stabilityPool.address,
        defaultPool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      defaultPool.setAddresses(cdpManager.address, activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      hintHelpers.setAddresses(priceFeed.address, sortedCDPs.address, cdpManager.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setGrowthTokenAddress(growthToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lockupContractFactory.setGrowthTokenAddress(growthToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setGrowthTokenAddress(growthToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setCLVTokenAddress(clvToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setCDPManagerAddress(cdpManager.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setBorrowerOperationsAddress(borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setActivePoolAddress(activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setStabilityPoolAddress(stabilityPool.address, {
        ...overrides,
        nonce
      })
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

  silent || console.log("Activating CommunityIssuance contract...");
  await (await contracts.communityIssuance.activateContract({ ...overrides })).wait();

  return contracts;
};
