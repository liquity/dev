import { describe, before, it } from "mocha";
import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";
import { web3, artifacts, ethers } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";

describe("utils/deploy", () => {
  let deployer: Signer;

  before(async () => {
    [deployer] = await ethers.getSigners();
  });

  it("should deploy and setup the contracts", async () => {
    const contracts = await deployAndSetupContracts(web3, artifacts, deployer);
    for (const contract of Object.values(contracts)) {
      expect(contract.address).to.match(/^0x[0-9-a-fA-F]{40}$/);
    }
  });
});
