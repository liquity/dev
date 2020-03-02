import { Wallet } from "ethers";
import { task, usePlugin, BuidlerConfig } from "@nomiclabs/buidler/config";

import { deployAndSetupContracts } from "./test/utils/deploy";
import { Liquity, Trove } from "./src/Liquity";
import { Decimal } from "./utils";

usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-waffle");

const generateRandomAccounts = (numberOfAccounts: number) => {
  const accounts = new Array<string>(numberOfAccounts);

  for (let i = 0; i < numberOfAccounts; ++i) {
    accounts[i] = Wallet.createRandom().privateKey;
  }

  return accounts;
};

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    parity: {
      url: "http://localhost:8545",
      accounts: [
        "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7",
        ...generateRandomAccounts(40)
      ]
    }
  },
  paths: {
    artifacts: "../contracts/artifacts",
    cache: "../contracts/cache"
  }
};

task("deploy", "Deploys the contracts to the network", async (_taskArgs, bre) => {
  const [deployer] = await bre.ethers.signers();
  const contracts = await deployAndSetupContracts(bre.artifacts, deployer);

  for (const [contractName, contract] of Object.entries(contracts)) {
    console.log(`${contractName}: "${contract.address}",`);
  }
});

task(
  "deploy-warzone",
  "Deploys the contracts to the network then creates lots of Troves",
  // TODO: for some reason Buidler can't seem to handle much more than 40 accounts with an external
  // network, so this task must be called repeatedly (e.g. in an infinite loop) to actually create
  // many Troves.
  async (_taskArgs, bre) => {
    const [deployer, ...users] = await bre.ethers.signers();

    const addresses = {
      activePool: "0x04700bCA4766f391fC55A4E36da0Be83daA849F6",
      cdpManager: "0xf9f6344919048Da7b8874780e575E087fEA009e5",
      clvToken: "0x277A693784789582F4A154a3Eb8fd827e99B5A88",
      defaultPool: "0xF686A081b216F818431267339B4e78E03D8282CC",
      nameRegistry: "0x289824E4291f8c2Ab27dC1dFDFc189401B06680a",
      poolManager: "0x581Ad97A398Ef2377a7d0c8A51Afc39Bc833Af7D",
      priceFeed: "0x3cd61B9D6e94F2fF4D51295EA9D2D581432adA01",
      sortedCDPs: "0x9F23490eF9A5F63546Dab89f3a6dED0Bf8467331",
      stabilityPool: "0xCb05a079C0EbC818961866EC38B7c05827Cfc96b"
    };

    let i = 0;
    for (const user of users) {
      const userAddress = await user.getAddress();
      const collateral = 999 * Math.random() + 1;
      const debt = (200 * collateral) / (3 * Math.random() + 1.11);

      const liquity = Liquity.connect(addresses, bre.waffle.provider, userAddress);

      await deployer.sendTransaction({
        to: userAddress,
        value: Decimal.from(collateral).bigNumber
      });

      liquity.createTrove(new Trove({ collateral, debt }));

      if (++i % 10 === 0) {
        console.log(`Created ${i} Troves.`);
      }
    }
  }
);

export default config;
