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
    activePool: "0x788b1f7A4976279305E43A08a5419F95B3B5545a",
    cdpManager: "0x086063A27f505b8eA5a0E65F2A34B26197ef419C",
    clvToken: "0x9FB0a538EC610e4fafb7d50338d417E6643463CB",
    defaultPool: "0x3B7af23BB5B69951c677D39dAe0809C7f3231E50",
    nameRegistry: "0xa650242F20F748bB861067FDe7B7766Ac17f3e64",
    poolManager: "0x35b7c50900b5B188536138f43cc6E1b978abF009",
    priceFeed: "0x74d37CE7E7210401a3432F8c49590723b3e211D2",
    sortedCDPs: "0x2142F04f584076a1783f6d86159bac83D10256d9",
    stabilityPool: "0xdB00Fbb08Fa75c77324661Cf46625d7399e954aB"
  },
  ropsten: {
    activePool: "0xc9E61022f5dBDF504a58afa76aacC4220079A9a4",
    cdpManager: "0x28c941d6A29b86036C18249C175CE2084f3983e7",
    clvToken: "0x44027D91b96edEC05fA68FAB4a63f4FafF8a3215",
    defaultPool: "0xfb34D074b790BbDFC33D8ded25429E911D04F46e",
    nameRegistry: "0x2068AeCa3506ad11E6271c2EF243a3288b9aF58E",
    poolManager: "0x9cfdce391bEFe2cf01ce6F3dAb4A44fC0DE272BE",
    priceFeed: "0x6dAC2E9E108E3CeA3cF52f3229C85491E4fddAdB",
    sortedCDPs: "0xe6a00Af68CB07c1fF7Bb1fd5Ec7fdC3ea562F018",
    stabilityPool: "0xF51951d51886ecd7b553C585238bb5Ab252400cB"
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
