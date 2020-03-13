import { Wallet } from "ethers";
import { task, usePlugin, BuidlerConfig } from "@nomiclabs/buidler/config";

import { deployAndSetupContracts } from "./test/utils/deploy";
import { Liquity, Trove } from "./src/Liquity";
import { Decimal } from "./utils";
import { CDPManagerFactory } from "./types/ethers/CDPManagerFactory";
import { PoolManagerFactory } from "./types/ethers/PoolManagerFactory";
import { PriceFeedFactory } from "./types/ethers/PriceFeedFactory";
import { NameRegistryFactory } from "./types/ethers/NameRegistryFactory";
import { LiquityContractAddresses } from "./src/contracts";

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

const addressesOnNetwork: { [network: string]: LiquityContractAddresses } = {
  dev: {
    activePool: "0x04700bCA4766f391fC55A4E36da0Be83daA849F6",
    cdpManager: "0xf9f6344919048Da7b8874780e575E087fEA009e5",
    clvToken: "0x277A693784789582F4A154a3Eb8fd827e99B5A88",
    defaultPool: "0xF686A081b216F818431267339B4e78E03D8282CC",
    nameRegistry: "0x289824E4291f8c2Ab27dC1dFDFc189401B06680a",
    poolManager: "0x581Ad97A398Ef2377a7d0c8A51Afc39Bc833Af7D",
    priceFeed: "0x080642CdB88e86600C77a866d4F375142906E93F",
    sortedCDPs: "0x9F23490eF9A5F63546Dab89f3a6dED0Bf8467331",
    stabilityPool: "0xCb05a079C0EbC818961866EC38B7c05827Cfc96b"
  },
  ropsten: {
    activePool: "0x710E14FBbaC14D819Be9a21E2089ebfdb8e3a95E",
    cdpManager: "0xa1B05856F06bD1967e7C7708F4553E7178C04dCc",
    clvToken: "0x907CC782Eb562BDce0191be0ceC8Cace3F00E081",
    defaultPool: "0xD2E0086c18548ece90ffC48586D2f5Ef21b39A51",
    nameRegistry: "0x9f8303f5D0fADc491EF92618aEDeCdbb228bd91f",
    poolManager: "0x1C4C34CEba6Db2Cf7F02D74D3A6A3501D0E5e76B",
    priceFeed: "0xC8A56BbA9d51214c5F09D4553e10895ff4777402",
    sortedCDPs: "0x5ADc1B1ba342597c1525f5D551F614B9D250925E",
    stabilityPool: "0x92E8FF4272e15983246418770FD076830Ff2E745"
  },
  rinkeby: {
    activePool: "0x5C3B80A5A5517567905a77d5DbBDeB455b174C5b",
    cdpManager: "0x3aC1A85a427227C83A3aE95Accd2022Fa1d6352A",
    clvToken: "0x6B681d4C1F835E236639F46929530a92a90768B1",
    defaultPool: "0xa77975FaCaA6dC5E8e436D39CdA52A4D398D10B2",
    nameRegistry: "0xf5b40E76cC51733F131BD9F0A82E752A1DcCe224",
    poolManager: "0xABA1eD61d4224831FE0e96F1054DD989FDd42310",
    priceFeed: "0x31E6ec35afD8aa3A915da2567Da1144a76E003E4",
    sortedCDPs: "0x6CF33ed909A1948a63e0Fd0e78F7AcF947736e1A",
    stabilityPool: "0x5F88149156Ab95BE985788F96EC30B0025CF8f0E"
  },
  goerli: {
    activePool: "0xecbc0A33CBf929DadD1D64B5E7A6247041402314",
    cdpManager: "0xB90C5d681AFcFD77D3938F2941AAd75fa95030D8",
    clvToken: "0x7A088435468F894A7Bb59fE9B92700570E0f884c",
    defaultPool: "0xEddE64C273aC266FC2758652b0BBaeE565808d34",
    nameRegistry: "0x3aC1A85a427227C83A3aE95Accd2022Fa1d6352A",
    poolManager: "0x8Aded274EB4B31a740945f0933eA2d0757350921",
    priceFeed: "0xABA1eD61d4224831FE0e96F1054DD989FDd42310",
    sortedCDPs: "0x5C3B80A5A5517567905a77d5DbBDeB455b174C5b",
    stabilityPool: "0x6B681d4C1F835E236639F46929530a92a90768B1"
  }
};

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    dev: {
      url: "http://localhost:8545",
      accounts: [
        "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7",
        ...generateRandomAccounts(40)
      ]
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/ad9cef41c9c844a7b54d10be24d416e5",
      accounts: ["0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1"]
    },
    rinkeby: {
      url: "https://rinkeby.infura.io/v3/ad9cef41c9c844a7b54d10be24d416e5",
      accounts: ["0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1"]
    },
    goerli: {
      url: "https://goerli.infura.io/v3/ad9cef41c9c844a7b54d10be24d416e5",
      accounts: ["0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1"]
    }
  },
  paths: {
    artifacts: "../contracts/artifacts",
    cache: "../contracts/cache"
  }
};

task("deploy", "Deploys the contracts to the network", async (_taskArgs, bre) => {
  const [deployer] = await bre.ethers.signers();
  const contracts = await deployAndSetupContracts(bre.web3, bre.artifacts, deployer);

  console.log();
  console.log("addresses = {");
  for (const [contractName, contract] of Object.entries(contracts)) {
    console.log(`  ${contractName}: "${contract.address}",`);
  }
  console.log("}");
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
    const [deployer, ...users] = await bre.ethers.signers();
    const addresses = addressesOnNetwork[bre.network.name];

    const liquity = await Liquity.connect(
      addresses.cdpManager,
      bre.waffle.provider,
      await deployer.getAddress()
    );

    const price = await liquity.getPrice();
    const priceAsNumber = parseFloat(price.toString(4));

    let i = 0;
    for (const user of users) {
      const userAddress = await user.getAddress();
      const collateral = 999 * Math.random() + 1;
      const debt = (priceAsNumber * collateral) / (3 * Math.random() + 1.11);

      const liquity = await Liquity.connect(addresses.cdpManager, bre.waffle.provider, userAddress);

      await deployer.sendTransaction({
        to: userAddress,
        value: Decimal.from(collateral).bigNumber
      });

      await liquity.createTrove(new Trove({ collateral, debt }), price);
      await liquity.depositQuiInStabilityPool(debt);

      if (++i % 10 === 0) {
        console.log(`Created ${i} Troves.`);
      }
    }
  }
);

export default config;
