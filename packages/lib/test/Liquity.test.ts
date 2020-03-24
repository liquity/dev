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

      await expect(liquity.createTrove(emptyTrove, price)).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with too little collateral", async () => {
      const troveWithTooLittleCollateral = new Trove({ collateral: 0.05 });

      await expect(liquity.createTrove(troveWithTooLittleCollateral, price)).to.eventually.be
        .rejected;
    });

    it("should create a Trove with only collateral", async () => {
      const troveWithOnlyCollateral = new Trove({ collateral: 1 });

      await liquity.createTrove(troveWithOnlyCollateral, price);
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

      await liquity.createTrove(troveWithSomeDebt, price);
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
      await otherLiquities[0].createTrove(new Trove({ collateral: 0.2233, debt: 39 }), price);
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
      await liquity.transferCollateralGainToTrove(deposit, trove, price);
      trove = await liquity.getTrove();
      deposit = await liquity.getStabilityDeposit();

      expect(trove).to.deep.equal(new Trove({ collateral: 2.2233, debt: 139 }));
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
    describe(".findLastTroveAboveMinimumCollateralRatio()", () => {
      describe("when there are no Troves", () => {
        before(async () => {
          // Deploy new instances of the contracts, for a clean slate
          addresses = addressesOf(await deployAndSetupContracts(web3, artifacts, deployer));
          [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
            deployer,
            user,
            ...otherUsers.slice(0, 3)
          ]);
        });

        it("should return undefined", async () => {
          const foundAddress = await liquity.findLastTroveAboveMinimumCollateralRatio();

          expect(foundAddress).to.be.undefined;
        });
      });

      describe("when there are Troves above and below the minimum collateral ratio", () => {
        before(async () => {
          await sendToEach(otherUsers, 1.2);

          price = Decimal.from(110);
          await deployerLiquity.setPrice(price);

          // Make sure TCR is healthy enough to allow creating a few Troves near the minimum ICR
          await liquity.createTrove(new Trove({ collateral: 2 }), price);

          // Right now the price is 110, soon to be dropped to 100.
          // We make 1 Trove that will drop below the MCR,
          // and 2 Troves that will end up with ICR == MCR
          await Promise.all([
            otherLiquities[0].createTrove(new Trove({ collateral: 1.1, debt: 110 }), price),
            otherLiquities[1].createTrove(new Trove({ collateral: 1.1, debt: 100 }), price),
            otherLiquities[2].createTrove(new Trove({ collateral: 1.1, debt: 100 }), price)
          ]);

          price = Decimal.from(100);
          await deployerLiquity.setPrice(price);
        });

        it("should find a Trove with ICR >= MCR that's followed by a Trove with ICR < MCR", async () => {
          const foundAddress = await liquity.findLastTroveAboveMinimumCollateralRatio();
          expect(foundAddress).to.not.be.undefined;

          const foundTrove = await liquity.getTrove(foundAddress);
          expect(foundTrove.collateralRatioAt(price).toString()).to.equal("1.1");

          const nextAddress = await liquity.getNextTrove(foundAddress!);
          expect(nextAddress).to.not.be.undefined;

          const nextTrove = await liquity.getTrove(nextAddress);
          expect(nextTrove.collateralRatioAt(price).toString()).to.equal("1");
        });
      });
    });
  });
});
