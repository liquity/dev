import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import { artifacts, ethers } from "@nomiclabs/buidler";
import { solidity } from "ethereum-waffle";

import { Signer } from "ethers";
import { bigNumberify } from "ethers/utils";

import { Decimal, Decimalish } from "../utils";
import { deployAndSetupContracts } from "./utils/deploy";
import { LiquityContracts } from "../src/contracts";
import { Liquity } from "../src/Liquity";

chai.use(solidity);

describe("Liquity", () => {
  let defaultSigner: Signer, otherSigner: Signer[];
  let contracts: LiquityContracts;
  let liquity: Liquity;

  before(async () => {
    [defaultSigner, ...otherSigner] = await ethers.signers();
    contracts = await deployAndSetupContracts(artifacts, defaultSigner);
    liquity = await Liquity.connectUsingNameRegistry(contracts.nameRegistry.address, otherSigner[0]);
  });
});
