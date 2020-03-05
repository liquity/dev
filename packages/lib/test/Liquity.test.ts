import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { artifacts, ethers, waffle } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";
import { Decimal } from "../utils/Decimal";
import { LiquityContractAddresses, addressesOf } from "../src/contracts";
import { Liquity, Trove } from "../src/Liquity";

const provider = waffle.provider;

chai.use(solidity);
chai.use(chaiAsPromised);

describe("Liquity", () => {
  const price = Decimal.from(200);
  let deployer: Signer;
  let user: Signer;
  let userAddress: string;
  let addresses: LiquityContractAddresses;
  let liquity: Liquity;
  let trove: Trove | undefined;

  before(async () => {
    [deployer, user] = await ethers.signers();
    userAddress = await user.getAddress();
    addresses = addressesOf(await deployAndSetupContracts(artifacts, deployer));
  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = Decimal.from(100).bigNumber;

    const gasLimit = 21000;
    const txCost = (await provider.getGasPrice()).mul(gasLimit);
    let balance = await provider.getBalance(userAddress);

    if (balance.eq(targetBalance)) return;

    if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
      await deployer.sendTransaction({
        to: userAddress,
        value: targetBalance
          .add(txCost)
          .sub(balance)
          .add(1),
        gasLimit
      });

      await user.sendTransaction({
        to: deployer.getAddress(),
        value: 1,
        gasLimit
      });
    } else {
      if (balance.lt(targetBalance)) {
        await deployer.sendTransaction({
          to: userAddress,
          value: targetBalance.sub(balance),
          gasLimit
        });
      } else {
        await user.sendTransaction({
          to: deployer.getAddress(),
          value: balance.sub(targetBalance).sub(txCost),
          gasLimit
        });
      }
    }

    expect(await provider.getBalance(userAddress)).to.equal(targetBalance);
  });

  it("should connect to contracts by CDPManager address", async () => {
    liquity = await Liquity.connect(addresses.cdpManager, provider, userAddress);
  });

  it("should have no Trove initially", async () => {
    trove = await liquity.getTrove();

    expect(trove).to.be.undefined;
  });

  it("should fail to create an empty Trove", async () => {
    const emptyTrove = new Trove();

    await expect(liquity.createTrove(emptyTrove, price)).to.eventually.be.rejected;
  });

  it("should fail to create a Trove with too little collateral", async () => {
    const troveWithTooLittleCollateral = new Trove({ collateral: 0.05 });

    await expect(liquity.createTrove(troveWithTooLittleCollateral, price)).to.eventually.be.rejected;
  });

  it("should create a Trove with only collateral", async () => {
    const troveWithOnlyCollateral = new Trove({ collateral: 1 });

    await liquity.createTrove(troveWithOnlyCollateral, price);
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(troveWithOnlyCollateral);
  });

  it("should close the Trove after withdrawing all the collateral", async () => {
    await liquity.withdrawEther(trove!, trove!.collateral, price);
    trove = await liquity.getTrove();

    expect(trove).to.be.undefined;
  });

  it("should create a Trove that already has debt", async () => {
    const troveWithSomeDebt = new Trove({ collateral: 1, debt: 100 });

    await liquity.createTrove(troveWithSomeDebt, price);
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(troveWithSomeDebt);
  });

  it("should fail to withdraw all the collateral while the Trove has debt", async () => {
    await expect(liquity.withdrawEther(trove!, trove!.collateral, price)).to.eventually.be.rejected;
  });

  it("should repay some debt", async () => {
    await liquity.repayQui(trove!, 10, price);
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 90 }));
  });

  it("should borrow some more", async () => {
    await liquity.borrowQui(trove!, 20, price);
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 110 }));
  });

  it("should deposit more collateral", async () => {
    await liquity.depositEther(trove!, 1, price);
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(new Trove({ collateral: 2, debt: 110 }));
  });
});
