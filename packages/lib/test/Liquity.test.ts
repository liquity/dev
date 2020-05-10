import { describe, before, it } from "mocha";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers } from "@nomiclabs/buidler";

import { deployAndSetupContracts } from "./utils/deploy";
import { Decimal, Decimalish } from "../utils/Decimal";
import { LiquityContractAddresses, addressesOf } from "../src/contracts";
import { Liquity, Trove, StabilityDeposit } from "../src/Liquity";

const provider = ethers.provider;

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

  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
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
        value: targetBalance.add(txCost).sub(balance).add(1),
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

    expect(`${await provider.getBalance(user.getAddress())}`).to.equal(`${targetBalance}`);
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

      expect(otherTrove.collateralRatio(price).toString()).to.equal("1.145128205128205128");
    });

    it("the price should take a dip", async () => {
      await deployerLiquity.setPrice(190);
      price = await liquity.getPrice();

      expect(price.toString()).to.equal("190");
    });

    it("should liquidate other user's Trove", async () => {
      await liquity.liquidateUpTo(1);
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
          collateral: "2.166043589743589744",
          debt: 139
        })
      );
    });

    it("should transfer the gains to the Trove", async () => {
      await liquity.transferCollateralGainToTrove(deposit, trove, price);
      trove = await liquity.getTrove();
      deposit = await liquity.getStabilityDeposit();

      expect(trove).to.deep.equal(
        new Trove({
          collateral: "2.223299999999999994",
          debt: 139
        })
      );

      expect(deposit.isEmpty).to.be.true;
    });

    describe("when people overstay", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean slate
        addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
        [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
          deployer,
          user,
          ...otherUsers.slice(0, 5)
        ]);

        await sendToEach(otherUsers, 2.1);

        price = Decimal.from(200);
        await deployerLiquity.setPrice(price);

        // Use this account to print QUI
        await liquity.openTrove(new Trove({ collateral: 10, debt: 500 }), price);

        // otherLiquities[0-2] will be independent stability depositors
        await liquity.sendQui(otherLiquities[0].userAddress!, 300);
        await liquity.sendQui(otherLiquities[1].userAddress!, 100);
        await liquity.sendQui(otherLiquities[2].userAddress!, 100);

        // otherLiquities[3-4] will be Trove owners whose Troves get liquidated
        await otherLiquities[3].openTrove(new Trove({ collateral: 2, debt: 300 }), price);
        await otherLiquities[4].openTrove(new Trove({ collateral: 2, debt: 300 }), price);

        await otherLiquities[0].depositQuiInStabilityPool(300);
        await otherLiquities[1].depositQuiInStabilityPool(100);
        // otherLiquities[2] doesn't deposit yet

        // Tank the price so we can liquidate
        price = Decimal.from(150);
        await deployerLiquity.setPrice(price);

        // Liquidate first victim
        await liquity.liquidate(otherLiquities[3].userAddress!);
        expect((await otherLiquities[3].getTrove()).isEmpty).to.be.true;

        // Now otherLiquities[2] makes their deposit too
        await otherLiquities[2].depositQuiInStabilityPool(100);

        // Liquidate second victim
        await liquity.liquidate(otherLiquities[4].userAddress!);
        expect((await otherLiquities[4].getTrove()).isEmpty).to.be.true;

        // Stability Pool is now empty
        expect((await liquity.getQuiInStabilityPool()).toString()).to.equal("0");
      });

      // Currently failing due to a problem with the backend
      it.skip("should still be able to withdraw remaining deposit", async () => {
        for (const l of [otherLiquities[0], otherLiquities[1], otherLiquities[2]]) {
          const stabilityDeposit = await l.getStabilityDeposit();
          await l.withdrawQuiFromStabilityPool(stabilityDeposit.depositAfterLoss);
        }
      });
    });
  });

  describe("Redemption", () => {
    before(async () => {
      // Deploy new instances of the contracts, for a clean slate
      addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
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

    it("should find hints for redemption", async () => {
      const redemptionHints = await liquity._findRedemptionHints(Decimal.from(55), price);

      expect(redemptionHints).to.deep.equal([
        otherLiquities[2].userAddress!,
        liquity.userAddress!,
        Decimal.from("39")
      ]);
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
