import { Wallet } from "ethers";
import { task, usePlugin, BuidlerConfig } from "@nomiclabs/buidler/config";
import { NetworkConfig } from "@nomiclabs/buidler/types";

import { deployAndSetupContracts, setSilent } from "./test/utils/deploy";
import { Liquity, Trove } from "./src/Liquity";
import { Decimal } from "./utils";
import { CDPManagerFactory } from "./types/ethers/CDPManagerFactory";
import { PoolManagerFactory } from "./types/ethers/PoolManagerFactory";
import { PriceFeedFactory } from "./types/ethers/PriceFeedFactory";
import { NameRegistryFactory } from "./types/ethers/NameRegistryFactory";
import { addressesOf, addressesOnNetwork } from "./src/contracts";

usePlugin("@nomiclabs/buidler-web3");
usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-waffle");

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const deployerAccount = "0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1";
const devChainRichAccount = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

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
      accounts: [deployerAccount, devChainRichAccount, ...generateRandomAccounts(40)]
    },
    ...infuraNetwork("ropsten"),
    ...infuraNetwork("rinkeby"),
    ...infuraNetwork("goerli"),
    ...infuraNetwork("kovan")
  },
  paths: {
    artifacts: "../contracts/artifacts",
    cache: "../contracts/cache"
  }
};

task("deploy", "Deploys the contracts to the network", async (_taskArgs, bre) => {
  const [deployer] = await bre.ethers.signers();

  setSilent(false);
  const contracts = await deployAndSetupContracts(bre.web3, bre.artifacts, deployer);

  console.log();
  console.log(addressesOf(contracts));
  console.log();
});

task(
  "update-pricefeed",
  "Deploys the latest version of PriceFeed then introduces it to other contracts",
  async (_taskArgs, bre) => {
    const [deployer] = await bre.ethers.signers();
    const addresses = addressesOnNetwork[bre.network.name];

    addresses.priceFeed = (await bre.artifacts.require("PriceFeed").new()).address;

    const priceFeed = PriceFeedFactory.connect(addresses.priceFeed, deployer);
    const cdpManager = CDPManagerFactory.connect(addresses.cdpManager, deployer);
    const poolManager = PoolManagerFactory.connect(addresses.poolManager, deployer);
    const nameRegistry = NameRegistryFactory.connect(addresses.nameRegistry, deployer);

    await priceFeed.setCDPManagerAddress(cdpManager.address);
    await cdpManager.setPriceFeed(priceFeed.address);
    await poolManager.setPriceFeed(priceFeed.address);
    await nameRegistry.updateAddress("PriceFeed", priceFeed.address);

    for (const [contractName, address] of Object.entries(addresses)) {
      console.log(`${contractName}: "${address}",`);
    }
  }
);

task(
  "deploy-warzone",
  "Deploys the contracts to the network then creates lots of Troves",
  // TODO: for some reason Buidler can't seem to handle much more than 40 accounts with an external
  // network, so this task must be called repeatedly (e.g. in an infinite loop) to actually create
  // many Troves.
  async (_taskArgs, bre) => {
    const [deployer, funder, ...randomUsers] = await bre.ethers.signers();
    const addresses =
      addressesOnNetwork[bre.network.name] ||
      addressesOf(await deployAndSetupContracts(bre.web3, bre.artifacts, deployer));

    const deployerLiquity = await Liquity.connect(addresses.cdpManager, deployer);

    const price = await deployerLiquity.getPrice();
    const priceAsNumber = parseFloat(price.toString(4));

    let i = 0;
    for (const user of randomUsers) {
      const userAddress = await user.getAddress();
      const collateral = 999 * Math.random() + 1;
      const debt = (priceAsNumber * collateral) / (3 * Math.random() + 1.11);

      const liquity = await Liquity.connect(addresses.cdpManager, user);

      await funder.sendTransaction({
        to: userAddress,
        value: Decimal.from(collateral).bigNumber
      });

      await liquity.createTrove(new Trove({ collateral, debt }), price);
      if (i % 4 === 0) {
        await liquity.depositQuiInStabilityPool(debt);
      }

      if (++i % 10 === 0) {
        console.log(`Created ${i} Troves.`);
      }

      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
);

export default config;
