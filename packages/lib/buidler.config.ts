import { task, usePlugin, BuidlerConfig } from "@nomiclabs/buidler/config";

import { deployAndSetupContracts } from "./test/utils/deploy";

usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-waffle");

const config: BuidlerConfig = {
  defaultNetwork: "buidlerevm",
  networks: {
    parity: {
      url: "http://localhost:8545",
      accounts: [
        "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7",
        "0xa056824b009f8496ee4baf259001dd7a9f8efc6ccc9c0e3ae207ee57eda09a9a",
        "0x543ab4105a87fa14619bad9b85b6e989412b2f30380a3f36f49b9327b5967fb1"
      ]
    }
  },
  paths: {
    artifacts: "../contracts/artifacts",
    cache: "../contracts/cache"
  }
}

task("deploy", "Deploys the contracts to the network", async (_taskArgs, bre) => {
  const [defaultSigner] = await bre.ethers.signers();
  const contracts = await deployAndSetupContracts(bre.artifacts, defaultSigner);

  for (const [contractName, contract] of Object.entries(contracts)) {
    console.log(contractName, '=>', contract.address);
  }
});

export default config;
