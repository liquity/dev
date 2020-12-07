import { describe, before, it } from "mocha";
import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "../utils/deploy";

describe("utils/deploy", () => {
  let deployer: Signer;

  before(async () => {
    [deployer] = await ethers.getSigners();
  });

  it("should deploy and setup the contracts", async () => {
    const { addresses } = await deployAndSetupContracts(deployer, ethers.getContractFactory);

    Object.values(addresses).forEach(address => {
      expect(address).to.match(/^0x[0-9-a-fA-F]{40}$/);
    });
  });
});
