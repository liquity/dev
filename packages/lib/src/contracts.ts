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
      activePool: "0xA9F32e6Cb0A295697705D37F905369a78179A49D",
      borrowerOperations: "0x5Ec34379eb9fA0C93bf7A4d6805Cb142C6b40e15",
      cdpManager: "0xdD77CD5cc42d4b336125B34E17488c88a9c05c7d",
      clvToken: "0x6a01AD9B7fdd8DAD6e9E2d859feD4821283315F4",
      defaultPool: "0x258c6845dEA747b7990E95f0040E93A56228586d",
      multiCDPgetter: "0x56333B40c26373EcC85190F3FA16cabAbB84B842",
      poolManager: "0xCF68BF11ed16Da53a38237616ff403995251a804",
      priceFeed: "0x49D98d09Ef21381Fe4981f041b5361D5F6350701",
      sortedCDPs: "0xfF3FE203cE97858cDb10c3D2A0d4C67bDa71F5d1",
      stabilityPool: "0x031262BEDb56aBD15E5Df024b3A6d9B6cfDB4b90"
    },
    version: "cadc6a73abb5627f1f03bdb1fd13606cdc5e820d",
    deploymentDate: 1589195337459
  },
  ropsten: {
    addresses: {
      activePool: "0x95cE87974DC956eD36a110c90E818943FDcA69A7",
      borrowerOperations: "",
      cdpManager: "0x7960558Dd5Df2038EDd9eaE671422035cd2A8a5A",
      clvToken: "0xee922B9c59BDa3E47305395A1e9e7bBE0Ca30be0",
      defaultPool: "0xae9C2aeE199FCF608458f68a317201f0CCf49801",
      multiCDPgetter: "",
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
      borrowerOperations: "",
      cdpManager: "0x46e5d5d619aF5D7E83976ad3013af84ED2D72337",
      clvToken: "0xd04b22d4651A4f4b5Ba8C57ED50c0c22A043320f",
      defaultPool: "0xE27B7479c7deaB917237a50D5c16c35D3817701d",
      multiCDPgetter: "",
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
      borrowerOperations: "",
      cdpManager: "0xff16410Ef5c54b986c4d6d9942822CcA4c9745e4",
      clvToken: "0x5e32CA7Bc1602899d15945ee750688d0365984E9",
      defaultPool: "0xE734F83F1E86F344E85836d3A4281525A0375e20",
      multiCDPgetter: "",
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
      borrowerOperations: "",
      cdpManager: "0xb2Fd7aA687e914272DB0d9892166637C80cBeA97",
      clvToken: "0x1462E077F7311164Cd9801cB8c56d8A844C6D8ad",
      defaultPool: "0x2aBa139ca57c9CE216E5823F3365f069f5C5F289",
      multiCDPgetter: "",
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
