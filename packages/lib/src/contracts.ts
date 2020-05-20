import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import activePoolJson from "../types/ActivePool.json";
import borrowerOperationsJson from "../types/BorrowerOperations.json";
import cdpManagerJson from "../types/CDPManager.json";
import clvTokenJson from "../types/CLVToken.json";
import defaultPoolJson from "../types/DefaultPool.json";
import multiCDPgetterJson from "../types/MultiCDPGetter.json";
import poolManagerJson from "../types/PoolManager.json";
import priceFeedJson from "../types/PriceFeed.json";
import sortedCDPsJson from "../types/SortedCDPs.json";
import stabilityPoolJson from "../types/StabilityPool.json";

import type {
  ActivePool,
  BorrowerOperations,
  CDPManager,
  CLVToken,
  DefaultPool,
  MultiCDPGetter,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
} from "../types";

export interface LiquityContractAddresses {
  activePool: string;
  borrowerOperations: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  multiCDPgetter: string;
  poolManager: string;
  priceFeed: string;
  sortedCDPs: string;
  stabilityPool: string;
}

export interface LiquityContracts {
  [name: string]: Contract;

  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  cdpManager: CDPManager;
  clvToken: CLVToken;
  defaultPool: DefaultPool;
  multiCDPgetter: MultiCDPGetter;
  poolManager: PoolManager;
  priceFeed: PriceFeed;
  sortedCDPs: SortedCDPs;
  stabilityPool: StabilityPool;
}

export const addressesOf = (contracts: LiquityContracts): LiquityContractAddresses => ({
  activePool: contracts.activePool.address,
  borrowerOperations: contracts.borrowerOperations.address,
  cdpManager: contracts.cdpManager.address,
  clvToken: contracts.clvToken.address,
  defaultPool: contracts.defaultPool.address,
  multiCDPgetter: contracts.multiCDPgetter.address,
  poolManager: contracts.poolManager.address,
  priceFeed: contracts.priceFeed.address,
  sortedCDPs: contracts.sortedCDPs.address,
  stabilityPool: contracts.stabilityPool.address
});

export const connectToContracts = (
  addresses: LiquityContractAddresses,
  signerOrProvider: Signer | Provider
): LiquityContracts => ({
  activePool: new Contract(addresses.activePool, activePoolJson.abi, signerOrProvider) as ActivePool,
  borrowerOperations: new Contract(
    addresses.borrowerOperations,
    borrowerOperationsJson.abi,
    signerOrProvider
  ) as BorrowerOperations,
  cdpManager: new Contract(addresses.cdpManager, cdpManagerJson.abi, signerOrProvider) as CDPManager,
  clvToken: new Contract(addresses.clvToken, clvTokenJson.abi, signerOrProvider) as CLVToken,
  defaultPool: new Contract(
    addresses.defaultPool,
    defaultPoolJson.abi,
    signerOrProvider
  ) as DefaultPool,
  multiCDPgetter: new Contract(
    addresses.multiCDPgetter,
    multiCDPgetterJson.abi,
    signerOrProvider
  ) as MultiCDPGetter,
  poolManager: new Contract(
    addresses.poolManager,
    poolManagerJson.abi,
    signerOrProvider
  ) as PoolManager,
  priceFeed: new Contract(addresses.priceFeed, priceFeedJson.abi, signerOrProvider) as PriceFeed,
  sortedCDPs: new Contract(addresses.sortedCDPs, sortedCDPsJson.abi, signerOrProvider) as SortedCDPs,
  stabilityPool: new Contract(
    addresses.stabilityPool,
    stabilityPoolJson.abi,
    signerOrProvider
  ) as StabilityPool
});

const deployments: { [network: string]: LiquityDeployment } = {
  dev: {
    addresses: {
      activePool: "0x85fd08eFd6Eb53b223D72977458B6eA3f511da9d",
      borrowerOperations: "0x1370D8f67354332561FF8E93Bbb2B97333A4c96c",
      cdpManager: "0xE5559E564a26AE1e45D5838318A7BB849Da98a31",
      clvToken: "0xcce4511541158dE5Ca64e7f66c0deAca7bC63BED",
      defaultPool: "0x07ADEC6FE9D1d7f8c1Aa027cB47e48323bF23C57",
      multiCDPgetter: "0x218Db6a1eA30a6a9231b74d165A8B6bE190Da2DB",
      poolManager: "0x00946BE81da943C301226e3FDA5645C1B7345c85",
      priceFeed: "0xDE82edAe1BE3A1a5c77c12F4DBFe69A11Ce13209",
      sortedCDPs: "0xCd19bb04FB7F83D2bc785614F4C8F1312c9aA32a",
      stabilityPool: "0x59E36625b9bd7D112bd0A9B285ef12eE92809714"
    },
    version: "4e9a65d4bb2eb26fe28d423f73c4318d5a138db4",
    deploymentDate: 1589261784000
  },
  ropsten: {
    addresses: {
      activePool: "0xC91b14c7086B29A9373028fa21d4d612Caf45E6c",
      borrowerOperations: "0xcfe4dDe82B2A71dfCe1387c9d7D2b4d5516326D2",
      cdpManager: "0x45a227cabb76fc6211941DA92d36a9b26b3626E0",
      clvToken: "0xB867d2bB97230D9A0dF214379466eA143b5E57A8",
      defaultPool: "0x3D5d3c5712Da0b84bb7b20d21d2E918e8c59eeda",
      multiCDPgetter: "0x6101FB38dCe4a0ce5e4dfFeABf606e97EC754Ed0",
      poolManager: "0x8997c6d057BD1E2ee3bbCC6d005E83Dc322A8339",
      priceFeed: "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4",
      sortedCDPs: "0x300b903B8c100D18C6ed2517A18BD6a8000d7542",
      stabilityPool: "0x8D5b49287bb16b53dE8E87d14Bf797d60B7fa765"
    },
    version: "4e9a65d4bb2eb26fe28d423f73c4318d5a138db4",
    deploymentDate: 1589261867078
  },
  rinkeby: {
    addresses: {
      activePool: "0x1e62843873ec20537158B88947B5a39C2741A098",
      borrowerOperations: "0x76aC120d6566f9B8e1E693982f31Db531400984B",
      cdpManager: "0x40B874F7119ED8de6CFFeAc6a7283acB041f8442",
      clvToken: "0xB01f5A28fF9BDaDE264d2d1A7a74A8f53a2cAC85",
      defaultPool: "0xE61f14fAE39112633fAF278147FC64ae12196878",
      multiCDPgetter: "0xE4c5aC36E82D40d7C84D5cdB3003711Ed6f17a0C",
      poolManager: "0x43c89B574cc6dc61BE7757D25D2da899F5752c84",
      priceFeed: "0xB355aC97Bd0f4612aE6e2d067bfba3774Fa6a45d",
      sortedCDPs: "0x41dc898a5627687662C157398A0fB1f8FaC402Db",
      stabilityPool: "0x57e4641Df0d9fB596E64fC880bC5ab35577d95Ef"
    },
    version: "4e9a65d4bb2eb26fe28d423f73c4318d5a138db4",
    deploymentDate: 1589260242888
  },
  goerli: {
    addresses: {
      activePool: "0x95cE87974DC956eD36a110c90E818943FDcA69A7",
      borrowerOperations: "0x7960558Dd5Df2038EDd9eaE671422035cd2A8a5A",
      cdpManager: "0xee922B9c59BDa3E47305395A1e9e7bBE0Ca30be0",
      clvToken: "0xae9C2aeE199FCF608458f68a317201f0CCf49801",
      defaultPool: "0xd1856e23a4dBBcc0b1Ec9a06185D5495b5fb7e70",
      multiCDPgetter: "0x793a85F986c8bAF3a546c5A6887Fb4e918582D3c",
      poolManager: "0x25C1E9c3D9026AC2B2e73c60C25E8f7A551FEfB1",
      priceFeed: "0xc0c291259e50378d2041dE14C984b9fB36F956D9",
      sortedCDPs: "0xa2c61f8DF37B64fCe3401c468d48A92f6f42E958",
      stabilityPool: "0x9ce999b06070370560E6EA8147f9ddeC2238680D"
    },
    version: "4e9a65d4bb2eb26fe28d423f73c4318d5a138db4",
    deploymentDate: 1589260316817
  },
  kovan: {
    addresses: {
      activePool: "0xa1000fab53d4B6F1B3e99780a98614421Fb1c0e3",
      borrowerOperations: "0x8723d13138Bc70038C0F86d728644Cf78785F67C",
      cdpManager: "0x52D28A0FC734329727610D4A53c9CdBC670700eD",
      clvToken: "0x9241C08874fcbBBfC6FE0011158bB11B34203bf8",
      defaultPool: "0x46e5d5d619aF5D7E83976ad3013af84ED2D72337",
      multiCDPgetter: "0x9475FA1DA5c01fD7D7E90BFFE29DA67B5d68e5B6",
      poolManager: "0xd04b22d4651A4f4b5Ba8C57ED50c0c22A043320f",
      priceFeed: "0xE27B7479c7deaB917237a50D5c16c35D3817701d",
      sortedCDPs: "0x3D90dABbaF965180F869d29CF616B45b4eFf7fA4",
      stabilityPool: "0xC41969b187957A9ab69cAAB91a7C9b16E84Cb108"
    },
    version: "4e9a65d4bb2eb26fe28d423f73c4318d5a138db4",
    deploymentDate: 1589260100675
  }
};

export const DEV_CHAIN_ID = 17;

type LiquityDeployment = {
  addresses: LiquityContractAddresses;
  version: string;
  deploymentDate: number;
};

export const deploymentOnNetwork: {
  [network: string]: LiquityDeployment;
  [chainId: number]: LiquityDeployment;
} = {
  ...deployments,

  3: deployments.ropsten,
  4: deployments.rinkeby,
  5: deployments.goerli,
  42: deployments.kovan,

  [DEV_CHAIN_ID]: deployments.dev
};
