import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { web3, artifacts, ethers } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";

chai.use(solidity);

describe("utils/deploy", () => {
  let deployer: Signer;

  before(async () => {
    [deployer] = await ethers.signers();
  });

  it("should deploy and setup the contracts", async () => {
    const contracts = await deployAndSetupContracts(web3, artifacts, deployer);
    for (const contract of Object.values(contracts)) {
      expect(contract.address).to.be.properAddress;
    }
  });
});
