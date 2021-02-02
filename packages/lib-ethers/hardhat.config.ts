import assert from "assert";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import "colors";

import { AddressZero } from "@ethersproject/constants";
import { JsonFragment } from "@ethersproject/abi";
import { Wallet } from "@ethersproject/wallet";
import { Signer } from "@ethersproject/abstract-signer";
import { Overrides } from "@ethersproject/contracts";

import { task, HardhatUserConfig, types, extendEnvironment } from "hardhat/config";
import { NetworkUserConfig } from "hardhat/types";
import "@nomiclabs/hardhat-ethers";

import { Decimal } from "@liquity/decimal";

import { deployAndSetupContracts, setSilent } from "./utils/deploy";
import { connectToContracts, LiquityDeployment, priceFeedIsTestnet } from "./src/contracts";

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
const aggregatorAddress = {
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  kovan: "0x9326BFA02ADD2366b30bacB125260Af641031331",
  rinkeby: "0x8A753747A1Fa494EC906cE90E9f37563A8AF630e"
};

const hasAggregator = (network: string): network is keyof typeof aggregatorAddress =>
  network in aggregatorAddress;

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
    ...infuraNetwork("mainnet")
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
      overrides?: Overrides
    ) => Promise<LiquityDeployment>;
  }
}

const getLiveArtifact = (name: string): { abi: JsonFragment[]; bytecode: string } =>
  require(`./live/${name}.json`);

extendEnvironment(env => {
  env.deployLiquity = async (deployer, useRealPriceFeed = false, overrides?: Overrides) => {
    const deployment = await deployAndSetupContracts(
      deployer,
      useLiveVersion
        ? (name, signer) => {
            const { abi, bytecode } = getLiveArtifact(name);
            return env.ethers.getContractFactory(abi, bytecode, signer);
          }
        : env.ethers.getContractFactory,
      !useRealPriceFeed,
      overrides
    );

    return { ...deployment, version: contractsVersion };
  };
});

type DeployParams = {
  channel: string;
  gasPrice?: number;
  useRealPriceFeed?: boolean;
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
  .setAction(async ({ channel, gasPrice, useRealPriceFeed }: DeployParams, env) => {
    const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).bigNumber };
    const [deployer] = await env.ethers.getSigners();

    useRealPriceFeed ??= env.network.name === "mainnet";

    if (useRealPriceFeed && !hasAggregator(env.network.name)) {
      throw new Error(`Aggregator unavailable on ${env.network.name}`);
    }

    setSilent(false);

    const deployment = await env.deployLiquity(deployer, useRealPriceFeed, overrides);

    if (useRealPriceFeed) {
      const contracts = connectToContracts(
        deployment.addresses,
        deployment.priceFeedIsTestnet,
        deployer
      );

      assert(!priceFeedIsTestnet(contracts.priceFeed));

      if (hasAggregator(env.network.name)) {
        console.log(
          `Hooking up PriceFeed with aggregator at ${aggregatorAddress[env.network.name]} ...`
        );

        const tx = await contracts.priceFeed.setAddresses(
          aggregatorAddress[env.network.name],
          AddressZero,
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
  });

export default config;
