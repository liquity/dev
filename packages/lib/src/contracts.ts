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
    activePool: "0xfcdbBcd136B1a75E4c4Ef1d4552335E6828111Da",
    cdpManager: "0x6C884b5D371CF5d238805b39B081076AB2B2F755",
    clvToken: "0xB02b407F450593b2873c3d24F24a33133cC75fE4",
    defaultPool: "0xA743052C8b0D2001Fc9aE8A18B35a00E0c16A69f",
    nameRegistry: "0x9859758EECEc3bFb0dED57534669FD8955dd2142",
    poolManager: "0xa6a68C2f8819EceBc71432dd86632BAcA9F1340e",
    priceFeed: "0x641766be0e72240b581a4b087C9Dc00131b4F65e",
    sortedCDPs: "0xE9AFc4F3966ca3D376064DD25Aa62C69B9fc8C23",
    stabilityPool: "0x05497Aa20B7F5862e1CC77251442d08E2BD8B7A2"
  },
  ropsten: {
    activePool: "0x568edce5b5F5ba4C4f4542E9ca54a16A2129f5d9",
    cdpManager: "0x30DAFD29dF36eA3C0E46035e8a42dBFeb2B33Ed3",
    clvToken: "0xC449BC140551787aB9DDB3D1073A0a4159a26002",
    defaultPool: "0xAE786dA82909BcF16C35a22E6A52e0F279a21cDc",
    nameRegistry: "0xD00D19C5118c5349BA2d39BbAAEEE344bC823E64",
    poolManager: "0x0E7efad1D6cDD7E43819CA5c3C858bf1ce10744d",
    priceFeed: "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4",
    sortedCDPs: "0x26b3B666041E5a0FDb97aa4bAC1344E920f67335",
    stabilityPool: "0x9e960845A06a4e0e4f0c3E7e1BFaD3FfB47213C0"
  },
  rinkeby: {
    activePool: "0xFD370Ce09fC5955ECd88F1Ee643457EFBe090d85",
    cdpManager: "0xD18387eA5031d2C45311D94Bdc462A4b1523f9d3",
    clvToken: "0xA9F3BC1B553A1182D140D693AD333Ca40BD6190A",
    defaultPool: "0x70bfE91398CF800FC56c8bfe6D6C70394399765a",
    nameRegistry: "0xADF29902bB8b016B04AC37fa9dD38cb63c72e8bf",
    poolManager: "0xFC846E237a08B64b79AfFc4cE21A9254A10ECa94",
    priceFeed: "0x4c3048b3F2372536c208c6c4D683e3AF68b4D769",
    sortedCDPs: "0x568edce5b5F5ba4C4f4542E9ca54a16A2129f5d9",
    stabilityPool: "0x30DAFD29dF36eA3C0E46035e8a42dBFeb2B33Ed3"
  },
  goerli: {
    activePool: "0x1CaC8ca10122C410ba0EACAB3909DCB51c683F39",
    cdpManager: "0x903B7887d50a19378443a7CeabD5835C3d4Ea06f",
    clvToken: "0x0F1821C6648A8d56eb59f46d6AaDB6e2b801eeFf",
    defaultPool: "0xBa5d54075901DDbe7e72d4592840B19593fFBf75",
    nameRegistry: "0x9DC807a7CD3ef2c5a0DDfb74B653F1E737b28Cf1",
    poolManager: "0xc54241325ba08Cd248ec7014AD417B6461c09F8A",
    priceFeed: "0xa0D6c2c3a16f8afEE4ea42b13f389281952CB5D2",
    sortedCDPs: "0x1c5cE3057F8Aeb3903a5C9bEFEB05db8D568aE8C",
    stabilityPool: "0xA3a7DE06c871692066c1a398655ED203A1BD133d"
  },
  kovan: {
    activePool: "0x28c941d6A29b86036C18249C175CE2084f3983e7",
    cdpManager: "0x44027D91b96edEC05fA68FAB4a63f4FafF8a3215",
    clvToken: "0xfb34D074b790BbDFC33D8ded25429E911D04F46e",
    defaultPool: "0x2068AeCa3506ad11E6271c2EF243a3288b9aF58E",
    nameRegistry: "0x9cfdce391bEFe2cf01ce6F3dAb4A44fC0DE272BE",
    poolManager: "0x6dAC2E9E108E3CeA3cF52f3229C85491E4fddAdB",
    priceFeed: "0xe6a00Af68CB07c1fF7Bb1fd5Ec7fdC3ea562F018",
    sortedCDPs: "0xF51951d51886ecd7b553C585238bb5Ab252400cB",
    stabilityPool: "0x8E09191579b5c86640680c8FdFBF533B128198cF"
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
