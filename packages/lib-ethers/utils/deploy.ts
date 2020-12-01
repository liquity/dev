import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction, ContractFactory, Overrides } from "@ethersproject/contracts";
import { AddressZero } from "@ethersproject/constants";

import { LiquityContractAddresses, LiquityContracts, connectToContracts } from "../src/contracts";

let silent = true;

const kovanAggregator = "0x9326BFA02ADD2366b30bacB125260Af641031331";

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
    troveManager: await deployContract(deployer, getContractFactory, "TroveManager", { ...overrides }),
    collSurplusPool: await deployContract(deployer, getContractFactory, "CollSurplusPool", {
      ...overrides
    }),
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
    // priceFeed: await deployContract(deployer, getContractFactory, "PriceFeed", { ...overrides }),
    priceFeedTestnet: await deployContract(deployer, getContractFactory, "PriceFeedTestnet", { ...overrides }),
    sortedTroves: await deployContract(deployer, getContractFactory, "SortedTroves", { ...overrides }),
    stabilityPool: await deployContract(deployer, getContractFactory, "StabilityPool", {
      ...overrides
    })
  };

  return {
    ...addresses,
    lusdToken: await deployContract(
      deployer,
      getContractFactory,
      "LUSDToken",
      addresses.troveManager,
      addresses.stabilityPool,
      addresses.borrowerOperations,
      { ...overrides }
    ),

    lqtyToken: await deployContract(
      deployer,
      getContractFactory,
      "LQTYToken",
      addresses.communityIssuance,
      addresses.lqtyStaking,
      addresses.lockupContractFactory,
      { ...overrides }
    ),

    multiTroveGetter: await deployContract(
      deployer,
      getContractFactory,
      "MultiTroveGetter",
      addresses.troveManager,
      addresses.sortedTroves,
      { ...overrides }
    )
  };
};

const connectContracts = async (
  {
    activePool,
    borrowerOperations,
    troveManager,
    lusdToken,
    collSurplusPool,
    communityIssuance,
    defaultPool,
    lqtyToken,
    hintHelpers,
    lockupContractFactory,
    lqtyStaking,
    // priceFeed,
    priceFeedTestnet,
    sortedTroves,
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
      sortedTroves.setParams(1e6, troveManager.address, borrowerOperations.address, {
        ...overrides,
        nonce
      }),

    // nonce =>
    //   priceFeed.setAddresses(
    //     AddressZero,
    //     { ...overrides, nonce }
    //   ),

    nonce =>
      priceFeedTestnet.setAddresses(
        network.name === "kovan" ? kovanAggregator : AddressZero,
        { ...overrides, nonce }
      ),

    nonce =>
      troveManager.setAddresses(
        borrowerOperations.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        collSurplusPool.address,
        priceFeedTestnet.address,
        lusdToken.address,
        sortedTroves.address,
        lqtyStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      borrowerOperations.setAddresses(
        troveManager.address,
        activePool.address,
        defaultPool.address,
        stabilityPool.address,
        collSurplusPool.address,
        priceFeedTestnet.address,
        sortedTroves.address,
        lusdToken.address,
        lqtyStaking.address,
        { ...overrides, nonce }
      ),

    nonce =>
      stabilityPool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        activePool.address,
        lusdToken.address,
        sortedTroves.address,
        priceFeedTestnet.address,
        communityIssuance.address,
        { ...overrides, nonce }
      ),

    nonce =>
      activePool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        stabilityPool.address,
        defaultPool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      defaultPool.setAddresses(troveManager.address, activePool.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      collSurplusPool.setAddresses(
        borrowerOperations.address,
        troveManager.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      hintHelpers.setAddresses(sortedTroves.address, troveManager.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      lqtyStaking.setAddresses(
        lqtyToken.address,
        lusdToken.address,
        troveManager.address,
        borrowerOperations.address,
        activePool.address,
        { ...overrides, nonce }
      ),

    nonce =>
      lockupContractFactory.setLQTYTokenAddress(lqtyToken.address, {
        ...overrides,
        nonce
      }),

    nonce =>
      communityIssuance.setAddresses(lqtyToken.address, stabilityPool.address, {
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

  // silent || console.log("Activating CommunityIssuance contract...");
  // await (await contracts.communityIssuance.activateContract({ ...overrides })).wait();

  return contracts;
};
