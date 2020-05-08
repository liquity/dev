import { Provider, TransactionReceipt } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractTransaction } from "@ethersproject/contracts";

import { LiquityContractAddresses, LiquityContracts, connectToContracts } from "../../src/contracts";

let silent = true;

export const setSilent = (s: boolean) => {
  silent = s;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const transactionReceipt = async (provider: Provider, transactionHash: string) => {
  silent || console.log(`Waiting for transaction ${transactionHash} ...`);

  for (;;) {
    const receipt = (await provider.getTransactionReceipt(
      transactionHash
    )) as TransactionReceipt | null;

    if (receipt) {
      return receipt;
    }

    await sleep(4000);
  }
};

const deployContract = async (provider: Provider, artifacts: any, contractName: string) => {
  silent || console.log(`Deploying ${contractName} ...`);

  const contract = await artifacts.require(contractName).new();
  const receipt = await transactionReceipt(provider, contract.transactionHash);

  if (!silent) {
    console.log({
      contractAddress: contract.address,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed
    });
    console.log();
  }

  return contract.address;
};

const deployContracts = async (
  provider: Provider,
  artifacts: any
): Promise<LiquityContractAddresses> => ({
  activePool: await deployContract(provider, artifacts, "ActivePool"),
  cdpManager: await deployContract(provider, artifacts, "CDPManager"),
  clvToken: await deployContract(provider, artifacts, "CLVToken"),
  defaultPool: await deployContract(provider, artifacts, "DefaultPool"),
  poolManager: await deployContract(provider, artifacts, "PoolManager"),
  priceFeed: await deployContract(provider, artifacts, "PriceFeed"),
  sortedCDPs: await deployContract(provider, artifacts, "SortedCDPs"),
  stabilityPool: await deployContract(provider, artifacts, "StabilityPool")
});

const connectContracts = async (
  {
    activePool,
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
  artifacts: any,
  deployer: Signer
): Promise<LiquityContracts> => {
  if (!deployer.provider) {
    throw new Error("Signer must have a provider.");
  }

  silent || (console.log("Deploying contracts..."), console.log());
  const addresses = await deployContracts(deployer.provider, artifacts);
  const contracts = connectToContracts(addresses, deployer);
  silent || console.log("Connecting contracts...");
  await connectContracts(contracts, deployer);

  return contracts;
};
