import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import "colors";

import { JsonFragment } from "@ethersproject/abi";
import { Wallet } from "@ethersproject/wallet";
import { Signer } from "@ethersproject/abstract-signer";
import { ContractFactory, Overrides } from "@ethersproject/contracts";

import { task, HardhatUserConfig, types, extendEnvironment } from "hardhat/config";
import { HardhatRuntimeEnvironment, NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";

import { Decimal } from "@liquity/lib-base";

import { deployAndSetupContracts, deployTellorCaller, setSilent } from "./utils/deploy";
import { _connectToContracts, _LiquityDeploymentJSON, _priceFeedIsTestnet } from "./src/contracts";

import accounts from "./accounts.json";

dotenv.config();

const numAccounts = 100;

const useLiveVersionEnv = (process.env.USE_LIVE_VERSION ?? "false").toLowerCase();
const useLiveVersion = !["false", "no", "0"].includes(useLiveVersionEnv);

const contractsDir = path.join("..", "contracts");
const artifacts = path.join(contractsDir, "artifacts");
const cache = path.join(contractsDir, "cache");

const contractsVersion = fs
  .readFileSync(path.join(useLiveVersion ? "live" : artifacts, "version"))
  .toString()
  .trim();

if (useLiveVersion) {
  console.log(`Using live version of contracts (${contractsVersion}).`.cyan);
}

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const deployerAccount = process.env.DEPLOYER_PRIVATE_KEY || Wallet.createRandom().privateKey;
const devChainRichAccount = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";

const infuraNetwork = (name: string): { [name: string]: NetworkUserConfig } => ({
  [name]: {
    url: `https://${name}.infura.io/v3/${infuraApiKey}`,
    accounts: [deployerAccount]
  }
});

// https://docs.chain.link/docs/ethereum-addresses
// https://docs.tellor.io/tellor/integration/reference-page

const oracleAddresses = {
  mainnet: {
    chainlink: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    tellor: "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0"
  },
  rinkeby: {
    chainlink: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e",
    tellor: "0x88dF592F8eb5D7Bd38bFeF7dEb0fBc02cf3778a0" // Core
  },
  kovan: {
    chainlink: "0x9326BFA02ADD2366b30bacB125260Af641031331",
    tellor: "0x20374E579832859f180536A69093A126Db1c8aE9" // Playground
  },
  goerli: {
    chainlink: "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e",
    tellor: "0x51c59c6cAd28ce3693977F2feB4CfAebec30d8a2"
  }
};

const hasOracles = (network: string): network is keyof typeof oracleAddresses =>
  network in oracleAddresses;

const wethAddresses = {
  mainnet: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  ropsten: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  rinkeby: "0xc778417E063141139Fce010982780140Aa0cD5Ab",
  goerli: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
  kovan: "0xd0A1E359811322d97991E03f863a0C30C2cF029C"
};

const hasWETH = (network: string): network is keyof typeof wethAddresses => network in wethAddresses;

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      accounts: accounts.slice(0, numAccounts),

      gas: 12e6, // tx gas limit
      blockGasLimit: 12e6,

      // Let Ethers throw instead of Buidler EVM
      // This is closer to what will happen in production
      throwOnCallFailures: false,
      throwOnTransactionFailures: false
    },

    dev: {
      url: "http://localhost:8545",
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(numAccounts - 2)]
    },

    ...infuraNetwork("ropsten"),
    ...infuraNetwork("rinkeby"),
    ...infuraNetwork("goerli"),
    ...infuraNetwork("kovan"),
    ...infuraNetwork("mainnet"),

    kiln: {
      url: "https://rpc.kiln.themerge.dev",
      accounts: [deployerAccount]
    },

    forkedMainnet: {
      url: "http://localhost:8545"
    }
  },

  paths: {
    artifacts,
    cache
  }
};

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    deployLiquity: (
      deployer: Signer,
      useRealPriceFeed?: boolean,
      wethAddress?: string,
      overrides?: Overrides
    ) => Promise<_LiquityDeploymentJSON>;
  }
}

const getLiveArtifact = (name: string): { abi: JsonFragment[]; bytecode: string } =>
  require(`./live/${name}.json`);

const getContractFactory: (
  env: HardhatRuntimeEnvironment
) => (name: string, signer: Signer) => Promise<ContractFactory> = useLiveVersion
  ? env => (name, signer) => {
      const { abi, bytecode } = getLiveArtifact(name);
      return env.ethers.getContractFactory(abi, bytecode, signer);
    }
  : env => env.ethers.getContractFactory;

extendEnvironment(env => {
  env.deployLiquity = async (
    deployer,
    useRealPriceFeed = false,
    wethAddress = undefined,
    overrides?: Overrides
  ) => {
    const deployment = await deployAndSetupContracts(
      deployer,
      getContractFactory(env),
      !useRealPriceFeed,
      env.network.name === "dev",
      wethAddress,
      overrides
    );

    return { ...deployment, version: contractsVersion };
  };
});

type DeployParams = {
  channel: string;
  gasPrice?: number;
  useRealPriceFeed?: boolean;
  createUniswapPair?: boolean;
};

const defaultChannel = process.env.CHANNEL || "default";

task("deploy", "Deploys the contracts to the network")
  .addOptionalParam("channel", "Deployment channel to deploy into", defaultChannel, types.string)
  .addOptionalParam("gasPrice", "Price to pay for 1 gas [Gwei]", undefined, types.float)
  .addOptionalParam(
    "useRealPriceFeed",
    "Deploy the production version of PriceFeed and connect it to Chainlink",
    undefined,
    types.boolean
  )
  .addOptionalParam(
    "createUniswapPair",
    "Create a real Uniswap v2 WETH-LUSD pair instead of a mock ERC20 token",
    undefined,
    types.boolean
  )
  .setAction(
    async ({ channel, gasPrice, useRealPriceFeed, createUniswapPair }: DeployParams, env) => {
      const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).hex };
      const [deployer] = await env.ethers.getSigners();

      useRealPriceFeed ??= env.network.name === "mainnet";

      if (useRealPriceFeed && !hasOracles(env.network.name)) {
        throw new Error(`PriceFeed not supported on ${env.network.name}`);
      }

      let wethAddress: string | undefined = undefined;
      if (createUniswapPair) {
        if (!hasWETH(env.network.name)) {
          throw new Error(`WETH not deployed on ${env.network.name}`);
        }
        wethAddress = wethAddresses[env.network.name];
      }

      setSilent(false);

      const deployment = await env.deployLiquity(deployer, useRealPriceFeed, wethAddress, overrides);

      if (useRealPriceFeed) {
        const contracts = _connectToContracts(deployer, deployment);

        assert(!_priceFeedIsTestnet(contracts.priceFeed));

        if (hasOracles(env.network.name)) {
          const tellorCallerAddress = await deployTellorCaller(
            deployer,
            getContractFactory(env),
            oracleAddresses[env.network.name].tellor,
            overrides
          );

          console.log(`Hooking up PriceFeed with oracles ...`);

          const tx = await contracts.priceFeed.setAddresses(
            oracleAddresses[env.network.name].chainlink,
            tellorCallerAddress,
            overrides
          );

          await tx.wait();
        }
      }

      fs.mkdirSync(path.join("deployments", channel), { recursive: true });

      fs.writeFileSync(
        path.join("deployments", channel, `${env.network.name}.json`),
        JSON.stringify(deployment, undefined, 2)
      );

      console.log();
      console.log(deployment);
      console.log();
    }
  );

type StorageSlotParams = {
  contractAddress: string;
  walletAddress: string;
  slotIndex: number;
  value: string;
};

task("setStorageSlotIndex", "Returns the index of the balanceOf storage slot in an ERC20")
  .addParam("contractAddress", "Address of the contract")
  .addParam("walletAddress", "Address of the wallet balance to set")
  .addOptionalParam("slotIndex", "Index of slot to set")
  .addOptionalParam("value", "Value of slot to set (assumed to be a number)")
  .setAction(
    async (
      {
        contractAddress,
        walletAddress,
        slotIndex = 0,
        value = "1000000000000000000000"
      }: StorageSlotParams,
      hre
    ) => {
      const utils = hre.ethers.utils;
      const erc20 = await hre.ethers.getContractAt("ERC20", contractAddress);
      const balanceBefore = await erc20.balanceOf(walletAddress);
      await hre.ethers.provider.send("hardhat_setStorageAt", [
        contractAddress,
        utils.hexStripZeros(
          utils.keccak256(
            utils.defaultAbiCoder.encode(["address", "uint"], [walletAddress, slotIndex])
          )
        ),
        hre.ethers.utils.hexlify(hre.ethers.utils.zeroPad(hre.ethers.BigNumber.from(value)._hex, 32))
      ]);
      const balanceNow = await erc20.balanceOf(walletAddress);
      console.log({ balanceBefore: balanceBefore.toString(), balanceNow: balanceNow.toString() });
    }
  );

export default config;
