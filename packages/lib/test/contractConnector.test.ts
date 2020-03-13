import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { web3, artifacts, ethers } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";
import { LiquityContracts, addressesOf } from "../src/contracts";
import { getContractsFromNameRegistry } from "../src/contractConnector";

chai.use(solidity);

describe("contractConnector", () => {
  let deployer: Signer;
  let contracts: LiquityContracts, registeredContracts: LiquityContracts;

  before(async () => {
    [deployer] = await ethers.signers();
    contracts = await deployAndSetupContracts(web3, artifacts, deployer);
  });

  it.skip("should fetch the contracts from name registry", async () => {
    registeredContracts = await getContractsFromNameRegistry(
      contracts.nameRegistry.address,
      deployer
    );
    for (const contract of Object.values(registeredContracts)) {
      expect(contract.address).to.be.properAddress;
    }
  });

  it.skip("should get back the same addresses from name-registry", () => {
    expect(addressesOf(registeredContracts)).to.deep.equal(addressesOf(contracts));
  });
});
