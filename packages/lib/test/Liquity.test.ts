import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { web3, artifacts, ethers, waffle } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";
import { Decimal } from "../utils/Decimal";
import { LiquityContractAddresses, addressesOf } from "../src/contracts";
import { Liquity, Trove, StabilityDeposit } from "../src/Liquity";

const provider = waffle.provider;

chai.use(solidity);
chai.use(chaiAsPromised);

describe("Liquity", () => {
  let price: Decimal;
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let userAddress: string;
  let otherUser: Signer;
  let addresses: LiquityContractAddresses;
  let deployerLiquity: Liquity;
  let liquity: Liquity;
  let otherLiquity: Liquity;
  let trove: Trove | undefined;
  let deposit: StabilityDeposit;

  before(async () => {
    [deployer, funder, user, otherUser] = await ethers.signers();
    userAddress = await user.getAddress();
    addresses = addressesOf(await deployAndSetupContracts(web3, artifacts, deployer));
  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = Decimal.from(100).bigNumber;

    const gasLimit = 21000;
    const txCost = (await provider.getGasPrice()).mul(gasLimit);
    let balance = await provider.getBalance(userAddress);

    if (balance.eq(targetBalance)) return;

    if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
      await funder.sendTransaction({
        to: userAddress,
        value: targetBalance
          .add(txCost)
          .sub(balance)
          .add(1),
        gasLimit
      });

      await user.sendTransaction({
        to: funder.getAddress(),
        value: 1,
        gasLimit
      });
    } else {
      if (balance.lt(targetBalance)) {
        await funder.sendTransaction({
          to: userAddress,
          value: targetBalance.sub(balance),
          gasLimit
        });
      } else {
        await user.sendTransaction({
          to: funder.getAddress(),
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

  it("should get the price", async () => {
    price = await liquity.getPrice();
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

  it("should make a small stability deposit", async () => {
    await liquity.depositQuiInStabilityPool(10);
  });

  before(async () => {
    const otherUserAddress = await otherUser.getAddress();
    otherLiquity = await Liquity.connect(addresses.cdpManager, provider, otherUserAddress);

    await funder.sendTransaction({ to: otherUserAddress, value: Decimal.from(0.23).bigNumber });
  });

  it("other user should make a Trove with very low ICR", async () => {
    await otherLiquity.createTrove(new Trove({ collateral: 0.2233, debt: 39 }), price);
    const otherTrove = await otherLiquity.getTrove();

    expect(otherTrove?.collateralRatioAt(price).toString()).to.equal("1.145128205128205128");
  });

  before(async () => {
    deployerLiquity = await Liquity.connect(
      addresses.cdpManager,
      provider,
      await deployer.getAddress()
    );
  });

  it("the price should take a dip", async () => {
    await deployerLiquity.setPrice(190);
    price = await liquity.getPrice();

    expect(price.toString()).to.equal("190");
  });

  it("should liquidate other user's Trove", async () => {
    await liquity.liquidate(1);
    const otherTrove = await otherLiquity.getTrove();

    expect(otherTrove).to.be.undefined;
  });

  it("should have a depleted stability deposit and some collateral gain", async () => {
    deposit = await liquity.getStabilityDeposit();

    expect(deposit).to.deep.equal(
      new StabilityDeposit({
        deposit: 10,
        pendingCollateralGain: "0.05725641025641026",
        pendingDepositLoss: 10
      })
    );
  });

  it("should have some pending rewards in the Trove", async () => {
    trove = await liquity.getTrove();

    expect(trove).to.deep.equal(
      new Trove({
        collateral: 2,
        debt: 110,
        pendingCollateralReward: "0.166043589743589744",
        pendingDebtReward: 29
      })
    );
  });

  // Currently failing due to a rounding problem in the contracts
  it("should transfer the gains to the Trove", async () => {
    await liquity.transferCollateralGainToTrove(deposit, trove!, price);
    trove = await liquity.getTrove();
    deposit = await liquity.getStabilityDeposit();

    expect(trove).to.deep.equal(new Trove({ collateral: 2.2233, debt: 139 }));
    expect(deposit.isEmpty).to.be.true;
  });
});
