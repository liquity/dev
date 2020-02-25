import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import { artifacts, ethers } from "@nomiclabs/buidler";
import { solidity } from "ethereum-waffle";

import { Signer } from "ethers";
import { deployAndSetupContracts } from "./utils/deploy";

chai.use(solidity);

describe("utils/deploy", () => {
  let defaultSigner: Signer;

  before(async () => {
    [defaultSigner] = await ethers.signers();
  });

  it("should deploy and setup the contracts", async () => {
    const contracts = await deployAndSetupContracts(artifacts, defaultSigner);
    for (const contract of Object.values(contracts)) {
      expect(contract.address).to.be.properAddress;
    }
  });
});
