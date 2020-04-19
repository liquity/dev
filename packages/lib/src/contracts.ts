import { Contract } from "ethers";

import { ActivePool } from "../types/ethers/ActivePool";
import { CDPManager } from "../types/ethers/CDPManager";
import { CLVToken } from "../types/ethers/CLVToken";
import { DefaultPool } from "../types/ethers/DefaultPool";
import { NameRegistry } from "../types/ethers/NameRegistry";
import { PoolManager } from "../types/ethers/PoolManager";
import { PriceFeed } from "../types/ethers/PriceFeed";
import { SortedCDPs } from "../types/ethers/SortedCDPs";
import { StabilityPool } from "../types/ethers/StabilityPool";

export interface LiquityContractAddresses {
  activePool: string;
  cdpManager: string;
  clvToken: string;
  defaultPool: string;
  nameRegistry: string;
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
  nameRegistry: NameRegistry;
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
  nameRegistry: contracts.nameRegistry.address,
  poolManager: contracts.poolManager.address,
  priceFeed: contracts.priceFeed.address,
  sortedCDPs: contracts.sortedCDPs.address,
  stabilityPool: contracts.stabilityPool.address
});

const deployments = {
  dev: {
    activePool: "0x3E5f5d00E07a306Ebf81c91B0adF045fD44B998c",
    cdpManager: "0xb8eA93eccC1ca118cDd02bF49b8da4B736071E33",
    clvToken: "0xf73627b2D9C1578b09b5881A0c80b80D5f268ff1",
    defaultPool: "0x499c741FE5768470FF97D1a08B624e3B0664FeA5",
    nameRegistry: "0x64252e7d909a4F3FfA8D3e62d7a7Cc9CA724cDe9",
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
    nameRegistry: "0x34f5dbd0Ad3B25f178Ad946f775d73022B407A55",
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
    nameRegistry: "0x7C11D4677D2574b364CecD7e68d461989077Cc8e",
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
    nameRegistry: "0xD00D19C5118c5349BA2d39BbAAEEE344bC823E64",
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
    nameRegistry: "0xC7e6b3649738875e51323Ae2C717dCFBC305eD5A",
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
