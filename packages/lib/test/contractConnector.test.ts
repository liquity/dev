import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import { artifacts, ethers } from "@nomiclabs/buidler";
import { solidity } from "ethereum-waffle";

import { Signer } from "ethers";

import { deployAndSetupContracts } from "./utils/deploy";
import { LiquityContracts } from "../src/contracts";
import { getContractsFromNameRegistry } from "../src/contractConnector";

chai.use(solidity);

describe("contractConnector", () => {
  let defaultSigner: Signer;
  let contracts: LiquityContracts,
      registeredContracts: LiquityContracts;

  before(async () => {
    [defaultSigner] = await ethers.signers();
    contracts = await deployAndSetupContracts(artifacts, defaultSigner);
  });

  it("should fetch the contracts from name registry", async () => {
    registeredContracts = await getContractsFromNameRegistry(contracts.nameRegistry.address, defaultSigner);
    for (const contract of Object.values(registeredContracts)) {
      expect(contract.address).to.be.properAddress;
    }
  });

  it("should get back the same addresses from name-registry", () => {
    const addressesOf = (contracts: LiquityContracts) => {
      return (Object.values(contracts)).map(contract => contract.address);
    }
    expect(addressesOf(registeredContracts)).to.deep.equal(addressesOf(contracts));
  });
});
