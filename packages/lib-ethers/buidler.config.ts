import fs from "fs";
import path from "path";
import dotenv from "dotenv";

import { Wallet } from "@ethersproject/wallet";

import { task, usePlugin, BuidlerConfig, types } from "@nomiclabs/buidler/config";
import { NetworkConfig } from "@nomiclabs/buidler/types";

import { Decimal } from "@liquity/decimal";

import { deployAndSetupContracts, setSilent } from "./utils/deploy";
import { connectToContracts, LiquityDeployment, priceFeedIsTestnet } from "./src/contracts";

import accounts from "./accounts.json";

const numAccounts = 100;

dotenv.config();

usePlugin("buidler-ethers-v5");

const useLiveVersionEnv = (process.env.USE_LIVE_VERSION ?? "false").toLowerCase();
const useLiveVersion = !["false", "no", "0"].includes(useLiveVersionEnv);

if (useLiveVersion) {
  console.log("Using live version of contracts.".cyan);
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

const infuraNetwork = (name: string): { [name: string]: NetworkConfig } => ({
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

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    buidlerevm: {
      // Let Ethers throw instead of Buidler EVM
      // This is closer to what will happen in production
      throwOnCallFailures: false,
      throwOnTransactionFailures: false,
      gas: 12e6, // tx gas limit
      blockGasLimit: 12e6,
      accounts: accounts.slice(0, numAccounts)
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
  paths: useLiveVersion
    ? {
        artifacts: "live/artifacts",
        cache: "live/cache"
      }
    : {
        artifacts: "../contracts/artifacts",
        cache: "../contracts/cache"
      }
};

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
  .setAction(async ({ channel, gasPrice, useRealPriceFeed }: DeployParams, bre) => {
    const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).bigNumber };
    const [deployer] = await bre.ethers.getSigners();

    useRealPriceFeed ??= bre.network.name === "mainnet";

    if (useRealPriceFeed && !hasAggregator(bre.network.name)) {
      throw new Error(`Aggregator unavailable on ${bre.network.name}`);
    }

    setSilent(false);

    const deployment: LiquityDeployment = {
      ...(await deployAndSetupContracts(
        deployer,
        bre.ethers.getContractFactory,
        !useRealPriceFeed,
        overrides
      )),
      version: fs.readFileSync(path.join(bre.config.paths.artifacts, "version")).toString().trim()
    };

    if (useRealPriceFeed) {
      const contracts = connectToContracts(
        deployment.addresses,
        deployment.priceFeedIsTestnet,
        deployer
      );

      if (!priceFeedIsTestnet(contracts.priceFeed) && hasAggregator(bre.network.name)) {
        console.log(
          `Hooking up PriceFeed with aggregator at ${aggregatorAddress[bre.network.name]} ...`
        );

        const tx = await contracts.priceFeed.setAddresses(
          aggregatorAddress[bre.network.name],
          overrides
        );

        await tx.wait();
      }
    }

    fs.mkdirSync(path.join("deployments", channel), { recursive: true });

    fs.writeFileSync(
      path.join("deployments", channel, `${bre.network.name}.json`),
      JSON.stringify(deployment, undefined, 2)
    );

    console.log();
    console.log({ [bre.network.name]: deployment });
    console.log();
  });

export default config;
