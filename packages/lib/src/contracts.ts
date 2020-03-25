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
    activePool: "0xA6e48001D69A5D615095F0375d60dd71fd393b37",
    cdpManager: "0x3bF4a33F720538B71286e3f28cF5D372D70b5Fe5",
    clvToken: "0xe083645D212b6b3EaDd31DA2F0A0A6eA33D332E8",
    defaultPool: "0xe3159fAb97078E0D89E4C44A54B7A099b57dF451",
    nameRegistry: "0x5D3244da881173EfdBCE78686eD2AB07A7CaF69d",
    poolManager: "0x12E11FfF08D980b8f9e4A688f894f5B2c0FC82b6",
    priceFeed: "0xD0D72701Ac7c4a4d68364f4343C4f11Ee5d7Bc45",
    sortedCDPs: "0xF8D1317cedD241cA0f7DFFbefaF4d3Da4bc65266",
    stabilityPool: "0xD679AA92Df211dc09FdDE7b49E4E27ED4ec50079"
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
    activePool: "0x710E14FBbaC14D819Be9a21E2089ebfdb8e3a95E",
    cdpManager: "0x907CC782Eb562BDce0191be0ceC8Cace3F00E081",
    clvToken: "0xD2E0086c18548ece90ffC48586D2f5Ef21b39A51",
    defaultPool: "0x9f8303f5D0fADc491EF92618aEDeCdbb228bd91f",
    nameRegistry: "0xC8A56BbA9d51214c5F09D4553e10895ff4777402",
    poolManager: "0x5ADc1B1ba342597c1525f5D551F614B9D250925E",
    priceFeed: "0x92E8FF4272e15983246418770FD076830Ff2E745",
    sortedCDPs: "0xdedDCEA0E907472A91430633B7f7dF0FAf78eD61",
    stabilityPool: "0x13eb8b14Da95b061F641eCeDc2EF1728e45972ad"
  },
  goerli: {
    activePool: "0x1C4C34CEba6Db2Cf7F02D74D3A6A3501D0E5e76B",
    cdpManager: "0x710E14FBbaC14D819Be9a21E2089ebfdb8e3a95E",
    clvToken: "0x907CC782Eb562BDce0191be0ceC8Cace3F00E081",
    defaultPool: "0xD2E0086c18548ece90ffC48586D2f5Ef21b39A51",
    nameRegistry: "0x9f8303f5D0fADc491EF92618aEDeCdbb228bd91f",
    poolManager: "0xC8A56BbA9d51214c5F09D4553e10895ff4777402",
    priceFeed: "0x5ADc1B1ba342597c1525f5D551F614B9D250925E",
    sortedCDPs: "0x92E8FF4272e15983246418770FD076830Ff2E745",
    stabilityPool: "0xdedDCEA0E907472A91430633B7f7dF0FAf78eD61"
  },
  kovan: {
    activePool: "0x8Aded274EB4B31a740945f0933eA2d0757350921",
    cdpManager: "0xecbc0A33CBf929DadD1D64B5E7A6247041402314",
    clvToken: "0x7A088435468F894A7Bb59fE9B92700570E0f884c",
    defaultPool: "0xEddE64C273aC266FC2758652b0BBaeE565808d34",
    nameRegistry: "0x3aC1A85a427227C83A3aE95Accd2022Fa1d6352A",
    poolManager: "0xABA1eD61d4224831FE0e96F1054DD989FDd42310",
    priceFeed: "0x5C3B80A5A5517567905a77d5DbBDeB455b174C5b",
    sortedCDPs: "0x6B681d4C1F835E236639F46929530a92a90768B1",
    stabilityPool: "0xa77975FaCaA6dC5E8e436D39CdA52A4D398D10B2"
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
