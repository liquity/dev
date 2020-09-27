import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { sha1 } from "object-hash";

import { Wallet } from "@ethersproject/wallet";

import { task, usePlugin, BuidlerConfig, types } from "@nomiclabs/buidler/config";
import { NetworkConfig } from "@nomiclabs/buidler/types";

import { Decimal } from "@liquity/decimal";

import { deployAndSetupContracts, setSilent } from "./utils/deploy";
import { abi, addressesOf, connectToContracts, LiquityDeployment } from ".";

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

const ropstenAggregator = "0x8468b2bDCE073A157E560AA4D9CcF6dB1DB98507";

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";

const infuraNetwork = (name: string): { [name: string]: NetworkConfig } => ({
  [name]: {
    url: `https://${name}.infura.io/v3/${infuraApiKey}`,
    accounts: [deployerAccount]
  }
});

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    dev: {
      url: "http://localhost:8545",
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(6)]
    },
    ...infuraNetwork("ropsten"),
    ...infuraNetwork("rinkeby"),
    ...infuraNetwork("goerli"),
    ...infuraNetwork("kovan")
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
};

const defaultChannel = process.env.CHANNEL || "default";

task("deploy", "Deploys the contracts to the network")
  .addOptionalParam("channel", "Deployment channel to deploy into", defaultChannel, types.string)
  .addOptionalParam("gasPrice", "Price to pay for 1 gas [Gwei]", undefined, types.float)
  .setAction(async ({ channel, gasPrice }: DeployParams, bre) => {
    const overrides = { gasPrice: gasPrice && Decimal.from(gasPrice).div(1000000000).bigNumber };
    const [deployer] = await bre.ethers.getSigners();

    setSilent(false);

    const contracts = await deployAndSetupContracts(
      deployer,
      bre.ethers.getContractFactory,
      overrides
    );

    const deployment: LiquityDeployment = {
      addresses: addressesOf(contracts),
      version: fs
        .readFileSync(path.join(bre.config.paths.artifacts, "version"))
        .toString()
        .trim(),
      deploymentDate: new Date().getTime(),
      abiHash: sha1(abi)
    };

    fs.mkdirSync(path.join("deployments", channel), { recursive: true });

    fs.writeFileSync(
      path.join("deployments", channel, `${bre.network.name}.json`),
      JSON.stringify(deployment, undefined, 2)
    );

    console.log();
    console.log({ [bre.network.name]: deployment });
    console.log();

    if (bre.network.name === "ropsten") {
      const { priceFeed } = connectToContracts(deployment.addresses, deployer);

      console.log("Hooking up PriceFeed with price aggregator...");
      const tx = await priceFeed.setAggregator_Testnet(ropstenAggregator, overrides);
      await tx.wait();
    }
  });

export default config;
