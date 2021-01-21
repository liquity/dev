import fs from "fs";

import { ethers } from "ethers";

import { MultiCaller } from "../multicaller/MultiCaller.json";

const devNetwork = "http://localhost:8545";

// Default account on OpenEthereum dev chain
const deployerKey = "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(devNetwork);
  const { chainId } = await provider.getNetwork();

  const deployer = new ethers.Wallet(deployerKey).connect(provider);
  const factory = new ethers.ContractFactory(MultiCaller.interface, MultiCaller.bytecode, deployer);

  const { address } = await factory.deploy();
  const deployment = { chainId, address };

  fs.writeFileSync("devDeployment.json", JSON.stringify(deployment, undefined, 2));

  console.log({ chainId, address });
})();
