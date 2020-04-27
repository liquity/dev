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

const deployments: { [network: string]: LiquityDeployment } = {
  dev: {
    addresses: {
      activePool: "0xfE04B3684B06573Ad578E718b7eC2c64328B8023",
      cdpManager: "0xafE6516b90181EAb998B1B0E1d203bB141d64ae1",
      clvToken: "0xB8C1D0B0BAC038399E4D34F8374A6654D4A5e2E7",
      defaultPool: "0xA724F8B936f0E9BC2745f8Cd84c3856214251B56",
      nameRegistry: "0xA287cb1cC48ef8FF85E1952014b3179B55Dd709C",
      poolManager: "0x58AF93Ac88C4D94D84283ED4403C030C3D81adCF",
      priceFeed: "0xC5A8A9E1d421736D70b6D9A80E6F2757f9CE770d",
      sortedCDPs: "0x4C90161Fe1103578f9c8a26a3EC7E54a1dd22Fd0",
      stabilityPool: "0xc6464962C7f11a435aDf0B2fC4e46F83c70BaaB8"
    },
    version: "a9ceffc8568a3824c01808046349fa9939f49e58",
    deploymentDate: 1587964446457
  },
  ropsten: {
    addresses: {
      activePool: "0x95cE87974DC956eD36a110c90E818943FDcA69A7",
      cdpManager: "0x7960558Dd5Df2038EDd9eaE671422035cd2A8a5A",
      clvToken: "0xee922B9c59BDa3E47305395A1e9e7bBE0Ca30be0",
      defaultPool: "0xae9C2aeE199FCF608458f68a317201f0CCf49801",
      nameRegistry: "0xd1856e23a4dBBcc0b1Ec9a06185D5495b5fb7e70",
      poolManager: "0x25C1E9c3D9026AC2B2e73c60C25E8f7A551FEfB1",
      priceFeed: "0xEF23fa01A1cFf44058495ea20daC9D64f285ffc4",
      sortedCDPs: "0xa2c61f8DF37B64fCe3401c468d48A92f6f42E958",
      stabilityPool: "0x9ce999b06070370560E6EA8147f9ddeC2238680D"
    },
    version: "a9ceffc8568a3824c01808046349fa9939f49e58",
    deploymentDate: 1587965630819
  },
  rinkeby: {
    addresses: {
      activePool: "0x9241C08874fcbBBfC6FE0011158bB11B34203bf8",
      cdpManager: "0x46e5d5d619aF5D7E83976ad3013af84ED2D72337",
      clvToken: "0xd04b22d4651A4f4b5Ba8C57ED50c0c22A043320f",
      defaultPool: "0xE27B7479c7deaB917237a50D5c16c35D3817701d",
      nameRegistry: "0x3D90dABbaF965180F869d29CF616B45b4eFf7fA4",
      poolManager: "0xC41969b187957A9ab69cAAB91a7C9b16E84Cb108",
      priceFeed: "0x9475FA1DA5c01fD7D7E90BFFE29DA67B5d68e5B6",
      sortedCDPs: "0xBb0bB1E44E062e8a9C40d02e08d8d75D0CF90938",
      stabilityPool: "0xB8F925De07e9a2108648992e7D5c898853410106"
    },
    version: "a9ceffc8568a3824c01808046349fa9939f49e58",
    deploymentDate: 1587965518759
  },
  goerli: {
    addresses: {
      activePool: "0x34f5dbd0Ad3B25f178Ad946f775d73022B407A55",
      cdpManager: "0xff16410Ef5c54b986c4d6d9942822CcA4c9745e4",
      clvToken: "0x5e32CA7Bc1602899d15945ee750688d0365984E9",
      defaultPool: "0xE734F83F1E86F344E85836d3A4281525A0375e20",
      nameRegistry: "0x937d0C55b38DFA9C405d2Cf32a2f3C59ce0E95c5",
      poolManager: "0xCDc026441d2d2852E73101f7Cd03dD0aEd1528D0",
      priceFeed: "0x3C6C7621D6A42b37c251e556304Dc7D091BE4Aca",
      sortedCDPs: "0xe3e9bb741c660e24bE35440a962Ca4487b8f95C0",
      stabilityPool: "0x089234DF647c196e282F557979bdbE74e9516A25"
    },
    version: "a9ceffc8568a3824c01808046349fa9939f49e58",
    deploymentDate: 1587966068973
  },
  kovan: {
    addresses: {
      activePool: "0x19B7d5fcBD7616E7Ee23C79D565E4b4F838E94e6",
      cdpManager: "0xb2Fd7aA687e914272DB0d9892166637C80cBeA97",
      clvToken: "0x1462E077F7311164Cd9801cB8c56d8A844C6D8ad",
      defaultPool: "0x2aBa139ca57c9CE216E5823F3365f069f5C5F289",
      nameRegistry: "0xFD370Ce09fC5955ECd88F1Ee643457EFBe090d85",
      poolManager: "0xD18387eA5031d2C45311D94Bdc462A4b1523f9d3",
      priceFeed: "0xA9F3BC1B553A1182D140D693AD333Ca40BD6190A",
      sortedCDPs: "0x70bfE91398CF800FC56c8bfe6D6C70394399765a",
      stabilityPool: "0xADF29902bB8b016B04AC37fa9dD38cb63c72e8bf"
    },
    version: "a9ceffc8568a3824c01808046349fa9939f49e58",
    deploymentDate: 1587965549686
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
