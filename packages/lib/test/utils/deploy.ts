import Web3 from "web3";
import { TransactionReceipt } from "web3-eth";
import { Signer, ContractTransaction } from "ethers";
import { Provider } from "ethers/providers";

import { LiquityContractAddresses, LiquityContracts } from "../../src/contracts";
import { connectToContracts } from "../../src/contractConnector";

// Bug in web3-eth: getTransactionReceipt is typed wrong. It returns null when the transaction is
// still pending.
// https://web3js.readthedocs.io/en/v1.2.0/web3-eth.html#gettransactionreceipt
declare module "web3-eth" {
  interface Eth {
    getTransactionReceipt(
      hash: string,
      callback?: (error: Error, transactionReceipt: TransactionReceipt) => void
    ): Promise<TransactionReceipt | null>;
  }
}

let silent = true;

export const setSilent = (s: boolean) => {
  silent = s;
};

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve(), ms));

const transactionReceipt = async (web3: Web3, transactionHash: string) => {
  silent || console.log(`Waiting for transaction ${transactionHash} ...`);

  for (;;) {
    const receipt = await web3.eth.getTransactionReceipt(transactionHash);

    if (receipt) {
      return receipt;
    }

    await sleep(4000);
  }
};

interface GenericContract extends Truffle.Contract<Truffle.ContractInstance> {
  "new"(meta?: Truffle.TransactionDetails): Promise<Truffle.ContractInstance>;
}

const deployContract = async (web3: Web3, artifacts: Truffle.Artifacts, contractName: string) => {
  silent || console.log(`Deploying ${contractName} ...`);

  const contract = await artifacts.require<GenericContract>(contractName).new();
  const receipt = await transactionReceipt(web3, contract.transactionHash);

  if (!silent) {
    console.log({
      contractAddress: contract.address,
      blockNumber: receipt.blockNumber
    });
    console.log();
  }

  return contract.address;
};

const deployContracts = async (
  web3: Web3,
  artifacts: Truffle.Artifacts
): Promise<LiquityContractAddresses> => ({
  activePool: await deployContract(web3, artifacts, "ActivePool"),
  cdpManager: await deployContract(web3, artifacts, "CDPManager"),
  clvToken: await deployContract(web3, artifacts, "CLVToken"),
  defaultPool: await deployContract(web3, artifacts, "DefaultPool"),
  nameRegistry: await deployContract(web3, artifacts, "NameRegistry"),
  poolManager: await deployContract(web3, artifacts, "PoolManager"),
  priceFeed: await deployContract(web3, artifacts, "PriceFeed"),
  sortedCDPs: await deployContract(web3, artifacts, "SortedCDPs"),
  stabilityPool: await deployContract(web3, artifacts, "StabilityPool")
});
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
  signerOrProvider: Signer | Provider
) => {
  let txCount: number | undefined;

  if (Signer.isSigner(signerOrProvider)) {
    txCount = await signerOrProvider.provider?.getTransactionCount(signerOrProvider.getAddress());
  }

  if (txCount === undefined) {
    throw new Error("Can't determine nonce");
  }

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

  const txs = await Promise.all(connections.map((connect, i) => connect(txCount! + i)));

  let i = 0;
  await Promise.all(txs.map(tx => tx.wait().then(() => silent || console.log(`Connected ${++i}`))));
};

export const deployAndSetupContracts = async (
  web3: Web3,
  artifacts: Truffle.Artifacts,
  signerOrProvider: Signer | Provider
): Promise<LiquityContracts> => {
  silent || (console.log("Deploying contracts..."), console.log());
  const addresses = await deployContracts(web3, artifacts);
  const contracts = connectToContracts(addresses, signerOrProvider);
  silent || console.log("Connecting contracts...");
  await connectContracts(contracts, signerOrProvider);
  //await nameRegisterContracts(contracts);

  return contracts;
};
