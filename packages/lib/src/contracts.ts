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
    activePool: "0xb749203580B59249464c74597F2699aa8D06ae32",
    cdpManager: "0x12955D7dc998A334A0E894F816691eA6dCbB8bf6",
    clvToken: "0xDD1491108D3E5867CEeA5Fa1860c4DC007f16cB6",
    defaultPool: "0x2b3BdA977e9BD62dd197FBF3F6014bF17f884e0B",
    nameRegistry: "0xe5ba4D0612839726709122E24403aB8C8f2e3907",
    poolManager: "0x4365092f879E650977898D526fC4cf3242937124",
    priceFeed: "0x6A38Eb8058cd7608a1a1C96e801E8d992271d7E1",
    sortedCDPs: "0x2fFCe9f2611Aea7f699f8E0EB8b071119c2D9ca2",
    stabilityPool: "0x6FB0cAbcDEC64222eC9e0e2D68050570DA237CE9"
  },
  ropsten: {
    activePool: "0x1CaC8ca10122C410ba0EACAB3909DCB51c683F39",
    cdpManager: "0x903B7887d50a19378443a7CeabD5835C3d4Ea06f",
    clvToken: "0x0F1821C6648A8d56eb59f46d6AaDB6e2b801eeFf",
    defaultPool: "0xBa5d54075901DDbe7e72d4592840B19593fFBf75",
    nameRegistry: "0x9DC807a7CD3ef2c5a0DDfb74B653F1E737b28Cf1",
    poolManager: "0xc54241325ba08Cd248ec7014AD417B6461c09F8A",
    priceFeed: "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4",
    sortedCDPs: "0xa0D6c2c3a16f8afEE4ea42b13f389281952CB5D2",
    stabilityPool: "0x1c5cE3057F8Aeb3903a5C9bEFEB05db8D568aE8C"
  },
  rinkeby: {
    activePool: "0x3Ec726ef4f367e9F862FbEb166392b9d6178BB87",
    cdpManager: "0xF603Ec727E6aCB282E57Fe75a76E7b6d3c6092Cd",
    clvToken: "0x68ACe8368059B7Abf5e9F910E47f88DcC6e8d8fc",
    defaultPool: "0x1CaC8ca10122C410ba0EACAB3909DCB51c683F39",
    nameRegistry: "0x903B7887d50a19378443a7CeabD5835C3d4Ea06f",
    poolManager: "0x0F1821C6648A8d56eb59f46d6AaDB6e2b801eeFf",
    priceFeed: "0xBa5d54075901DDbe7e72d4592840B19593fFBf75",
    sortedCDPs: "0x9DC807a7CD3ef2c5a0DDfb74B653F1E737b28Cf1",
    stabilityPool: "0xc54241325ba08Cd248ec7014AD417B6461c09F8A"
  },
  goerli: {
    activePool: "0x8E09191579b5c86640680c8FdFBF533B128198cF",
    cdpManager: "0x3822f43aed92EEF53892C122a207B8fa397463b5",
    clvToken: "0x7e5Cee95ef8ce7D5Ebf7928C7c8229490cd364Ed",
    defaultPool: "0xaF7eed3c1d1CB44913f18e2d980ec52dCF44d903",
    nameRegistry: "0xC642a5f51D53365504Fc4809E748c0de6a997295",
    poolManager: "0x5fe77578A5bD49e8791C0960aBa4BAaEf1C104b5",
    priceFeed: "0xb1fF7D44bF8d69A6C1d167BEe2Dcb0c3d2C451aF",
    sortedCDPs: "0x9641B268bF51F1E7b72aFBeA2a242d64387A77f8",
    stabilityPool: "0xA064F2c45839d1347A549b5429061baA0974BdD8"
  },
  kovan: {
    activePool: "0x1C4C34CEba6Db2Cf7F02D74D3A6A3501D0E5e76B",
    cdpManager: "0x710E14FBbaC14D819Be9a21E2089ebfdb8e3a95E",
    clvToken: "0x907CC782Eb562BDce0191be0ceC8Cace3F00E081",
    defaultPool: "0xD2E0086c18548ece90ffC48586D2f5Ef21b39A51",
    nameRegistry: "0x9f8303f5D0fADc491EF92618aEDeCdbb228bd91f",
    poolManager: "0xC8A56BbA9d51214c5F09D4553e10895ff4777402",
    priceFeed: "0x5ADc1B1ba342597c1525f5D551F614B9D250925E",
    sortedCDPs: "0x92E8FF4272e15983246418770FD076830Ff2E745",
    stabilityPool: "0xdedDCEA0E907472A91430633B7f7dF0FAf78eD61"
  }
};

export const addressesOnNetwork: {
  [network: string]: LiquityContractAddresses;
  [chainId: number]: LiquityContractAddresses;
} = {
  ...deployments,
  3: deployments.ropsten,
  4: deployments.rinkeby,
  5: deployments.goerli,
  17: deployments.dev,
  42: deployments.kovan
};
