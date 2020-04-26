import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";

import activePoolJson from "../types/ActivePool.json";
import cdpManagerJson from "../types/CDPManager.json";
import clvTokenJson from "../types/CLVToken.json";
import defaultPoolJson from "../types/DefaultPool.json";
import poolManagerJson from "../types/PoolManager.json";
import priceFeedJson from "../types/PriceFeed.json";
import sortedCDPsJson from "../types/SortedCDPs.json";
import stabilityPoolJson from "../types/StabilityPool.json";

import type {
  ActivePool,
  CDPManager,
  CLVToken,
  DefaultPool,
  PoolManager,
  PriceFeed,
  SortedCDPs,
  StabilityPool
} from "../types";

export interface LiquityContractAddresses {
  activePool: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  poolManager: string;
  priceFeed: string;
  sortedCDPs: string;
  stabilityPool: string;
}

export interface LiquityContracts {
  [name: string]: Contract;

  activePool: ActivePool;
  cdpManager: CDPManager;
  clvToken: CLVToken;
  defaultPool: DefaultPool;
  poolManager: PoolManager;
  priceFeed: PriceFeed;
  sortedCDPs: SortedCDPs;
  stabilityPool: StabilityPool;
}

export const addressesOf = (contracts: LiquityContracts): LiquityContractAddresses => ({
  activePool: contracts.activePool.address,
  cdpManager: contracts.cdpManager.address,
  clvToken: contracts.clvToken.address,
  defaultPool: contracts.defaultPool.address,
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
  cdpManager: new Contract(addresses.cdpManager, cdpManagerJson.abi, signerOrProvider) as CDPManager,
  clvToken: new Contract(addresses.clvToken, clvTokenJson.abi, signerOrProvider) as CLVToken,
  defaultPool: new Contract(
    addresses.defaultPool,
    defaultPoolJson.abi,
    signerOrProvider
  ) as DefaultPool,
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

export const connectToContractsViaCdpManager = async (
  cdpManagerAddress: string,
  signerOrProvider: Signer | Provider
): Promise<LiquityContracts> => {
  const cdpManager = new Contract(
    cdpManagerAddress,
    cdpManagerJson.abi,
    signerOrProvider
  ) as CDPManager;

  const [
    priceFeed,
    sortedCDPs,
    clvToken,
    [poolManager, activePool, defaultPool, stabilityPool]
  ] = await Promise.all([
    cdpManager.priceFeedAddress().then(address => {
      return new Contract(address, priceFeedJson.abi, signerOrProvider) as PriceFeed;
    }),
    cdpManager.sortedCDPsAddress().then(address => {
      return new Contract(address, sortedCDPsJson.abi, signerOrProvider) as SortedCDPs;
    }),
    cdpManager.clvTokenAddress().then(address => {
      return new Contract(address, clvTokenJson.abi, signerOrProvider) as CLVToken;
    }),
    cdpManager.poolManagerAddress().then(address => {
      const poolManager = new Contract(
        address,
        poolManagerJson.abi,
        signerOrProvider
      ) as PoolManager;

      return Promise.all([
        Promise.resolve(poolManager),

        poolManager.activePoolAddress().then(address => {
          return new Contract(address, activePoolJson.abi, signerOrProvider) as ActivePool;
        }),
        poolManager.defaultPoolAddress().then(address => {
          return new Contract(address, defaultPoolJson.abi, signerOrProvider) as DefaultPool;
        }),
        poolManager.stabilityPoolAddress().then(address => {
          return new Contract(address, stabilityPoolJson.abi, signerOrProvider) as StabilityPool;
        })
      ]);
    })
  ]);

  return {
    activePool,
    cdpManager,
    clvToken,
    defaultPool,
    poolManager,
    priceFeed,
    sortedCDPs,
    stabilityPool
  };
};

const deployments = {
  dev: {
    activePool: "0x3E5f5d00E07a306Ebf81c91B0adF045fD44B998c",
    cdpManager: "0xb8eA93eccC1ca118cDd02bF49b8da4B736071E33",
    clvToken: "0xf73627b2D9C1578b09b5881A0c80b80D5f268ff1",
    defaultPool: "0x499c741FE5768470FF97D1a08B624e3B0664FeA5",
    poolManager: "0x21A8380C633C6A297a1DB443DeF2d655Ef9764dF",
    priceFeed: "0x96D8fb18C797D6ef7e817E386061417F3CCDFAe4",
    sortedCDPs: "0x8813363b48fCa1257ef349eC6E2712f169061408",
    stabilityPool: "0x9b2C3a063822a1f92c6bcCeb6977Ef3bc4C8f1b2"
  },
  ropsten: {
    activePool: "0xC0848415D68f2F57e243C9fa1a41541Bd2d17C5A",
    cdpManager: "0x405143dAe9a8a703a1fE82ad4B65BBFE5505AF63",
    clvToken: "0x37B5459ECCFE7a1dE8373dfF76ece99E46cD9Fef",
    defaultPool: "0xcB586D059052386C34f454E00007dD594b21ce40",
    poolManager: "0xff16410Ef5c54b986c4d6d9942822CcA4c9745e4",
    priceFeed: "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4",
    sortedCDPs: "0xE734F83F1E86F344E85836d3A4281525A0375e20",
    stabilityPool: "0x937d0C55b38DFA9C405d2Cf32a2f3C59ce0E95c5"
  },
  rinkeby: {
    activePool: "0xbe26F3b72cd68a49ae2245FBa70105E5e23C3c2A",
    cdpManager: "0x67959000206a26c2D201C01a00C5c31Af8C2Fcbe",
    clvToken: "0x589Dfca9608ebcD327f210838AB38F5Ca9eCf4e7",
    defaultPool: "0x3E66F90D92705Bb0a119f8C746998C37c255B071",
    poolManager: "0xc42ADc9e258B4e44f01332B7973B835ad5608308",
    priceFeed: "0xf4e5c61442253723EC95731fD4df6A2ec63ae4e9",
    sortedCDPs: "0x48909A5b104EB7486E7f21033fd1129FFd19B774",
    stabilityPool: "0x7C0645CBe518A7713f173D45e6131dcE591Ae0a1"
  },
  goerli: {
    activePool: "0x568edce5b5F5ba4C4f4542E9ca54a16A2129f5d9",
    cdpManager: "0x30DAFD29dF36eA3C0E46035e8a42dBFeb2B33Ed3",
    clvToken: "0xC449BC140551787aB9DDB3D1073A0a4159a26002",
    defaultPool: "0xAE786dA82909BcF16C35a22E6A52e0F279a21cDc",
    poolManager: "0x0E7efad1D6cDD7E43819CA5c3C858bf1ce10744d",
    priceFeed: "0xCe8c78FF89F1eFBFf947090833DA3fB4110Bd1D4",
    sortedCDPs: "0x26b3B666041E5a0FDb97aa4bAC1344E920f67335",
    stabilityPool: "0x9e960845A06a4e0e4f0c3E7e1BFaD3FfB47213C0"
  },
  kovan: {
    activePool: "0xe55299AccFBcc75069a1bDF7d0fa586F8fe40cA5",
    cdpManager: "0xa9655879c7D6B5eD6138457A7a17479FB9506e49",
    clvToken: "0x085A242eAc5fA3032adB79465a4d31e6d994075d",
    defaultPool: "0xC139cd2871DB23A9F2F7de0a9a1e103d8cc87f24",
    poolManager: "0x3Ec726ef4f367e9F862FbEb166392b9d6178BB87",
    priceFeed: "0xF603Ec727E6aCB282E57Fe75a76E7b6d3c6092Cd",
    sortedCDPs: "0x68ACe8368059B7Abf5e9F910E47f88DcC6e8d8fc",
    stabilityPool: "0x1CaC8ca10122C410ba0EACAB3909DCB51c683F39"
  }
};

export const DEV_CHAIN_ID = 17;

export const addressesOnNetwork: {
  [network: string]: LiquityContractAddresses;
  [chainId: number]: LiquityContractAddresses;
} = {
  ...deployments,

  3: deployments.ropsten,
  4: deployments.rinkeby,
  5: deployments.goerli,
  42: deployments.kovan,

  [DEV_CHAIN_ID]: deployments.dev
};
