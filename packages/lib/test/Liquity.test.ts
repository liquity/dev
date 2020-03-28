import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer } from "ethers";
import { solidity } from "ethereum-waffle";
import { web3, artifacts, ethers, waffle } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";
import { Decimal, Decimalish } from "../utils/Decimal";
import { LiquityContractAddresses, addressesOf } from "../src/contracts";
import { Liquity, Trove, StabilityDeposit } from "../src/Liquity";

const provider = waffle.provider;

chai.use(solidity);
chai.use(chaiAsPromised);

describe("Liquity", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let addresses: LiquityContractAddresses;

  let deployerLiquity: Liquity;
  let liquity: Liquity;
  let otherLiquities: Liquity[];

  let price: Decimal;
  let trove: Trove;
  let deposit: StabilityDeposit;

  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.signers();
    addresses = addressesOf(await deployAndSetupContracts(web3, artifacts, deployer));
  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = Decimal.from(100).bigNumber;

    const gasLimit = 21000;
    const txCost = (await provider.getGasPrice()).mul(gasLimit);
    let balance = await provider.getBalance(user.getAddress());

    if (balance.eq(targetBalance)) return;

    if (balance.gt(targetBalance) && balance.lte(targetBalance.add(txCost))) {
      await funder.sendTransaction({
        to: user.getAddress(),
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
          to: user.getAddress(),
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

    expect(await provider.getBalance(user.getAddress())).to.equal(targetBalance);
  });

  it("should connect to contracts by CDPManager address", async () => {
    liquity = await Liquity.connect(addresses.cdpManager, user);
  });

  it("should get the price", async () => {
    price = await liquity.getPrice();
  });

  describe("Trove", () => {
    it("should have no Trove initially", async () => {
      trove = await liquity.getTrove();

      expect(trove.isEmpty).to.be.true;
    });

    it("should fail to create an empty Trove", async () => {
      const emptyTrove = new Trove();

      await expect(liquity.openTrove(emptyTrove, price)).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with too little collateral", async () => {
      const troveWithTooLittleCollateral = new Trove({ collateral: 0.05 });

      await expect(liquity.openTrove(troveWithTooLittleCollateral, price)).to.eventually.be.rejected;
    });

    it("should create a Trove with only collateral", async () => {
      const troveWithOnlyCollateral = new Trove({ collateral: 1 });

      await liquity.openTrove(troveWithOnlyCollateral, price);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(troveWithOnlyCollateral);
    });

    it("should close the Trove after withdrawing all the collateral", async () => {
      await liquity.withdrawEther(trove, trove.collateral, price);
      trove = await liquity.getTrove();

      expect(trove.isEmpty).to.be.true;
    });

    it("should create a Trove that already has debt", async () => {
      const troveWithSomeDebt = new Trove({ collateral: 1, debt: 100 });

      await liquity.openTrove(troveWithSomeDebt, price);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(troveWithSomeDebt);
    });

    it("should fail to withdraw all the collateral while the Trove has debt", async () => {
      await expect(liquity.withdrawEther(trove, trove.collateral, price)).to.eventually.be.rejected;
    });

    it("should repay some debt", async () => {
      await liquity.repayQui(trove, 10, price);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 90 }));
    });

    it("should borrow some more", async () => {
      await liquity.borrowQui(trove, 20, price);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 110 }));
    });

    it("should deposit more collateral", async () => {
      await liquity.depositEther(trove, 1, price);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 2, debt: 110 }));
    });
  });

  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map(user => Liquity.connect(addresses.cdpManager, user)));

  describe("StabilityPool", () => {
    before(async () => {
      [deployerLiquity, ...otherLiquities] = await connectUsers([
        deployer,
        ...otherUsers.slice(0, 1)
      ]);

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: Decimal.from(0.23).bigNumber
      });
    });

    it("should make a small stability deposit", async () => {
      await liquity.depositQuiInStabilityPool(10);
    });

    it("other user should make a Trove with very low ICR", async () => {
      await otherLiquities[0].openTrove(new Trove({ collateral: 0.2233, debt: 39 }), price);
      const otherTrove = await otherLiquities[0].getTrove();

      expect(otherTrove.collateralRatioAt(price).toString()).to.equal("1.145128205128205128");
    });

    it("the price should take a dip", async () => {
      await deployerLiquity.setPrice(190);
      price = await liquity.getPrice();

      expect(price.toString()).to.equal("190");
    });

    it("should liquidate other user's Trove", async () => {
      await liquity.liquidateMany(1);
      const otherTrove = await otherLiquities[0].getTrove();

      expect(otherTrove.isEmpty).to.be.true;
    });

    it("should have a depleted stability deposit and some collateral gain", async () => {
      deposit = await liquity.getStabilityDeposit();

      expect(deposit).to.deep.equal(
        new StabilityDeposit({
          deposit: 10,
          pendingCollateralGain: "0.05725641025641025",
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
          pendingCollateralReward: "0.166043589743589742",
          pendingDebtReward: 29
        })
      );
    });

    it("should transfer the gains to the Trove", async () => {
      await liquity.transferCollateralGainToTrove(deposit, trove, price);
      trove = await liquity.getTrove();
      deposit = await liquity.getStabilityDeposit();

      // With ABDKMath64x64, a microscopic amount of Ether can get lost
      expect(trove).to.deep.equal(new Trove({ collateral: "2.223299999999999991", debt: 139 }));
      expect(deposit.isEmpty).to.be.true;
    });
  });

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());

    return Promise.all(
      users.map((user, i) =>
        funder.sendTransaction({
          to: user.getAddress(),
          value: Decimal.from(value).bigNumber,
          nonce: txCount + i
        })
      )
    );
  };

  describe("Redemption", () => {
    before(async () => {
      // Deploy new instances of the contracts, for a clean slate
      addresses = addressesOf(await deployAndSetupContracts(web3, artifacts, deployer));
      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsers.slice(0, 3)
      ]);

      await sendToEach(otherUsers, 1.1);

      price = Decimal.from(200);
      await deployerLiquity.setPrice(price);

      await Promise.all([
        liquity.openTrove(new Trove({ collateral: 20, debt: 100 }), price),
        otherLiquities[0].openTrove(new Trove({ collateral: 1, debt: 10 }), price),
        otherLiquities[1].openTrove(new Trove({ collateral: 1, debt: 20 }), price),
        otherLiquities[2].openTrove(new Trove({ collateral: 1, debt: 30 }), price)
      ]);
    });

    it("should find a hint for partial redemption", async () => {
      const hint = await liquity._findCollateralRatioOfPartiallyRedeemedTrove(
        Decimal.from(55),
        price
      );

      expect(hint.toString()).to.equal("39");
    });

    it("should redeem some collateral", async () => {
      const tx = await liquity.redeemCollateral(55, price);
      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.not.be.undefined;

      const balance = new Decimal(await provider.getBalance(user.getAddress()));

      expect(balance.toString()).to.equal(
        Decimal.from(100.275)
          .sub(new Decimal(tx.gasPrice.mul(receipt.gasUsed!)))
          .toString()
      );

      expect((await liquity.getQuiBalance()).toString()).to.equal("45");

      expect((await otherLiquities[0].getTrove()).debt.toString()).to.equal("5");
      expect((await otherLiquities[1].getTrove()).debt.toString()).to.equal("0");
      expect((await otherLiquities[2].getTrove()).debt.toString()).to.equal("0");
    });
  });
});
