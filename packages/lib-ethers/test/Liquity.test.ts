import { describe, before, it } from "mocha";
import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network } from "@nomiclabs/buidler";

import { Decimal, Decimalish } from "@liquity/decimal";
import { Trove, StabilityDeposit } from "@liquity/lib-base";

import { deployAndSetupContracts } from "../utils/deploy";
import { HintHelpers } from "../types";
import { LiquityContracts, LiquityContractAddresses, addressesOf } from "../src/contracts";
import { EthersLiquity, redeemMaxIterations } from "../src/EthersLiquity";

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

// Typed wrapper around Chai's
function assertStrictEquals<T>(actual: unknown, expected: T, message?: string): asserts actual is T {
  assert.strictEqual(actual, expected, message);
}

// TODO make the testcases isolated

describe("EthersLiquity", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let addresses: LiquityContractAddresses;

  let deployerLiquity: EthersLiquity;
  let liquity: EthersLiquity;
  let otherLiquities: EthersLiquity[];

  let price: Decimal;
  let trove: Trove;
  let deposit: StabilityDeposit;

  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map(user => EthersLiquity.connect(addresses, user)));

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());

    const txs = await Promise.all(
      users.map((user, i) =>
        funder.sendTransaction({
          to: user.getAddress(),
          value: Decimal.from(value).bigNumber,
          nonce: txCount + i
        })
      )
    );

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
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

    if (balance.eq(targetBalance)) {
      return;
    }

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

  it("should connect to contracts by their addresses", async () => {
    liquity = await EthersLiquity.connect(addresses, user);
  });

  it("should get the price", async () => {
    price = await liquity.getPrice();
  });

  describe("_findHintForCollateralRatio", () => {
    it("should pick the closest approx hint", async () => {
      type Resolved<T> = T extends Promise<infer U> ? U : never;
      type ApproxHint = Resolved<ReturnType<HintHelpers["getApproxHint"]>>;

      const fakeHints: ApproxHint[] = [
        { diff: BigNumber.from(3), hintAddress: "alice", latestRandomSeed: BigNumber.from(1111) },
        { diff: BigNumber.from(4), hintAddress: "bob", latestRandomSeed: BigNumber.from(2222) },
        { diff: BigNumber.from(1), hintAddress: "carol", latestRandomSeed: BigNumber.from(3333) },
        { diff: BigNumber.from(2), hintAddress: "dennis", latestRandomSeed: BigNumber.from(4444) }
      ];

      const fakeContracts = {
        cdpManager: {}, // avoid TypeError in EthersLiquity constructor

        hintHelpers: chai.spy.interface({
          getApproxHint: (..._args: any) => Promise.resolve(fakeHints.shift())
        }),

        sortedCDPs: chai.spy.interface({
          findInsertPosition: (..._args: any) => Promise.resolve(["fake insert position"])
        })
      };

      const fakeLiquity = new EthersLiquity(fakeContracts as LiquityContracts);

      const collateralRatio = Decimal.from("1.5");
      const price = Decimal.from(200);

      await fakeLiquity._findHintForCollateralRatio(collateralRatio, {
        numberOfTroves: 1000000, // 10 * sqrt(1M) / 2500 = 4 expected getApproxHint calls
        price
      });

      expect(fakeContracts.hintHelpers.getApproxHint).to.have.been.called.exactly(4);
      expect(fakeContracts.hintHelpers.getApproxHint).to.have.been.called.with(
        collateralRatio.bigNumber,
        price.bigNumber
      );

      // returned latestRandomSeed should be passed back on the next call
      expect(fakeContracts.hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(1111));
      expect(fakeContracts.hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(2222));
      expect(fakeContracts.hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(3333));

      expect(fakeContracts.sortedCDPs.findInsertPosition).to.have.been.called.once;
      expect(fakeContracts.sortedCDPs.findInsertPosition).to.have.been.called.with(
        collateralRatio.bigNumber,
        price.bigNumber,
        "carol"
      );
    });
  });

  describe("Trove", () => {
    it("should have no Trove initially", async () => {
      trove = await liquity.getTrove();

      expect(trove.isEmpty).to.be.true;
    });

    it("should fail to create an empty Trove", async () => {
      const emptyTrove = new Trove();

      await expect(liquity.openTrove(emptyTrove)).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with too low ICR", async () => {
      const troveWithTooLowIcr = new Trove({ collateral: 0.05, debt: 10 });

      await expect(liquity.openTrove(troveWithTooLowIcr)).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with only collateral", async () => {
      const troveWithOnlyCollateral = new Trove({ collateral: 1 });

      await expect(liquity.openTrove(troveWithOnlyCollateral)).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with too little debt", async () => {
      const troveWithTooLittleDebt = new Trove({ collateral: 1, debt: 5 });

      await expect(liquity.openTrove(troveWithTooLittleDebt)).to.eventually.be.rejected;
    });

    it("should create a Trove with the minimum amount of debt", async () => {
      const troveWithMinimumAmountOfDebt = new Trove({ collateral: 1, debt: 10 });

      await liquity.openTrove(troveWithMinimumAmountOfDebt);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(troveWithMinimumAmountOfDebt);
    });

    it("should withdraw some of the collateral", async () => {
      const troveWithHalfOfTheCollateral = new Trove({ collateral: 0.5, debt: 10 });

      await liquity.withdrawEther(0.5);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(troveWithHalfOfTheCollateral);
    });

    it("should fail to close the Trove when there are no other Troves", async () => {
      const numberOfTroves = await liquity.getNumberOfTroves();
      expect(numberOfTroves).to.equal(1);

      expect(liquity.closeTrove()).to.eventually.be.rejected;
    });

    it("should close the Trove after another user creates a Trove", async () => {
      const funderLiquity = await EthersLiquity.connect(addresses, funder);
      await funderLiquity.openTrove(new Trove({ collateral: 1, debt: 10 }));

      await liquity.closeTrove();
      trove = await liquity.getTrove();

      expect(trove.isEmpty).to.be.true;
    });

    it("should create a Trove with some more debt", async () => {
      const troveWithSomeDebt = new Trove({ collateral: 1, debt: 100 });

      await liquity.openTrove(troveWithSomeDebt);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(troveWithSomeDebt);
    });

    it("should fail to withdraw all the collateral while the Trove has debt", async () => {
      await expect(liquity.withdrawEther(trove.collateral)).to.eventually.be.rejected;
    });

    it("should repay some debt", async () => {
      await liquity.repayQui(10);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 90 }));
    });

    it("should borrow some more", async () => {
      await liquity.borrowQui(20);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 1, debt: 110 }));
    });

    it("should deposit more collateral", async () => {
      await liquity.depositEther(1);
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(new Trove({ collateral: 2, debt: 110 }));
    });

    it("should repay some debt and withdraw some collateral at the same time", async () => {
      const finalTrove = new Trove({ collateral: 1.5, debt: 50 });

      await liquity.changeTrove(trove.whatChanged(finalTrove), undefined, { gasPrice: 0 });
      trove = await liquity.getTrove();
      const ethBalance = new Decimal(await user.getBalance());

      expect(trove).to.deep.equal(finalTrove);
      expect(`${ethBalance}`).to.equal("100.5");
    });

    it("should borrow more and deposit some collateral at the same time", async () => {
      const finalTrove = new Trove({ collateral: 2, debt: 110 });

      await liquity.changeTrove(trove.whatChanged(finalTrove), undefined, { gasPrice: 0 });
      trove = await liquity.getTrove();
      const ethBalance = new Decimal(await user.getBalance());

      expect(trove).to.deep.equal(finalTrove);
      expect(`${ethBalance}`).to.equal("99.5");
    });
  });

  describe("ParsedEthersTransaction", () => {
    it("should parse failed transactions without throwing", async () => {
      const invalidTrove = new Trove({ debt: 10 });
      const ampleGas = BigNumber.from(10).pow(6);

      // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
      const tx = await liquity.openTrove(invalidTrove, undefined, { gasLimit: ampleGas });
      const { status } = await tx.waitForReceipt();

      expect(status).to.equal("failed");
    });
  });

  describe("StabilityPool", () => {
    before(async () => {
      addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));

      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsers.slice(0, 1)
      ]);

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: Decimal.from(0.23).bigNumber
      });
    });

    it("should make a small stability deposit", async () => {
      await liquity.openTrove(new Trove({ collateral: 1, debt: 100 }));
      await liquity.depositQuiInStabilityPool(10);
    });

    it("other user should make a Trove with very low ICR", async () => {
      await otherLiquities[0].openTrove(new Trove({ collateral: 0.2233, debt: 39 }));
      const otherTrove = await otherLiquities[0].getTrove();

      expect(`${otherTrove.collateralRatio(price)}`).to.equal("1.145128205128205128");
    });

    it("the price should take a dip", async () => {
      await deployerLiquity.setPrice(190);
      price = await liquity.getPrice();

      expect(`${price}`).to.equal("190");
    });

    it("should liquidate other user's Trove", async () => {
      const tx = await liquity.liquidateUpTo(1);

      const receipt = await tx.waitForReceipt();
      assertStrictEquals(receipt.status, "succeeded" as const);

      expect(receipt.details).to.deep.equal({
        fullyLiquidated: [otherLiquities[0].userAddress],
        partiallyLiquidated: undefined,

        collateralGasCompensation: Decimal.from(0.0011165), // 0.5%
        tokenGasCompensation: Decimal.from(10),

        totalLiquidated: new Trove({
          collateral: Decimal.from(0.2221835), // -0.5%
          debt: Decimal.from(39)
        })
      });

      const otherTrove = await otherLiquities[0].getTrove();
      expect(otherTrove.isEmpty).to.be.true;
    });

    it("should have a depleted stability deposit and some collateral gain", async () => {
      deposit = await liquity.getStabilityDeposit();

      expect(deposit).to.deep.equal(
        new StabilityDeposit({
          deposit: 10,
          depositAfterLoss: 0,
          pendingCollateralGain: "0.0569701282051282" // multiplied by 0.995
        })
      );
    });

    it("should have some pending rewards in the Trove", async () => {
      trove = await liquity.getTrove();

      expect(trove).to.deep.equal(
        new Trove({
          collateral: "1.165213371794871795",
          debt: 129
        })
      );
    });

    it("total should equal the Trove", async () => {
      const numberOfTroves = await liquity.getNumberOfTroves();
      expect(numberOfTroves).to.equal(1);

      const total = await liquity.getTotal();
      expect(total.equals(trove)).to.be.true;
    });

    it("should transfer the gains to the Trove", async () => {
      await liquity.transferCollateralGainToTrove();
      trove = await liquity.getTrove();
      deposit = await liquity.getStabilityDeposit();

      expect(trove).to.deep.equal(
        new Trove({
          collateral: "1.222183499999999995", // ~ 1 + 0.2233 * 0.995
          debt: 129
        })
      );

      expect(deposit.isEmpty).to.be.true;
    });

    describe("when non-empty in recovery mode", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean slate
        addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
        const otherUsersSubset = otherUsers.slice(0, 2);
        [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
          deployer,
          user,
          ...otherUsersSubset
        ]);

        await sendToEach(otherUsersSubset, 1.1);

        price = Decimal.from(200);
        await deployerLiquity.setPrice(price);

        await otherLiquities[0].openTrove(new Trove({ collateral: 1, debt: 100 }));
        await otherLiquities[1].openTrove(new Trove({ collateral: 1, debt: 100 }));

        await liquity.openTrove(new Trove({ collateral: 10.075, debt: 1410 }));
        await liquity.depositQuiInStabilityPool(100);

        price = Decimal.from(190);
        await deployerLiquity.setPrice(price);

        const total = await deployerLiquity.getTotal();
        expect(total.collateralRatio(price).lt(1.5)).to.be.true;
      });

      it("should partially liquidate the bottom Trove", async () => {
        await liquity.liquidateUpTo(40);

        trove = await liquity.getTrove();
        // 10.075 * 1310 / 1410
        expect(trove).to.deep.equal(new Trove({ collateral: "9.360460992907801419", debt: 1310 }));
      });

      describe("after depositing some more tokens", () => {
        before(async () => {
          await liquity.depositQuiInStabilityPool(1300);
          await otherLiquities[0].depositQuiInStabilityPool(10);
        });

        it("should liquidate more of the bottom Trove", async () => {
          await liquity.liquidateUpTo(40);

          trove = await liquity.getTrove();
          expect(trove.isEmpty).to.be.true;
        });
      });
    });

    describe("when people overstay", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean slate
        addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
        const otherUsersSubset = otherUsers.slice(0, 5);
        [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
          deployer,
          user,
          ...otherUsersSubset
        ]);

        await sendToEach(otherUsersSubset, 2.1);

        price = Decimal.from(200);
        await deployerLiquity.setPrice(price);

        // Use this account to print QUI
        await liquity.openTrove(new Trove({ collateral: 10, debt: 510 }));

        // otherLiquities[0-2] will be independent stability depositors
        await liquity.sendQui(otherLiquities[0].userAddress!, 300);
        await liquity.sendQui(otherLiquities[1].userAddress!, 100);
        await liquity.sendQui(otherLiquities[2].userAddress!, 100);

        // otherLiquities[3-4] will be Trove owners whose Troves get liquidated
        await otherLiquities[3].openTrove(new Trove({ collateral: 2, debt: 300 }));
        await otherLiquities[4].openTrove(new Trove({ collateral: 2, debt: 300 }));

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
        expect(`${await liquity.getQuiInStabilityPool()}`).to.equal("0");
      });

      it("should still be able to withdraw remaining deposit", async () => {
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
      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 1.1);

      await liquity.openTrove(new Trove({ collateral: 20, debt: 110 }));
      await otherLiquities[0].openTrove(new Trove({ collateral: 1, debt: 20 }));
      await otherLiquities[1].openTrove(new Trove({ collateral: 1, debt: 30 }));
      await otherLiquities[2].openTrove(new Trove({ collateral: 1, debt: 40 }));
    });

    it("should find hints for redemption", async () => {
      const redemptionHints = await liquity._findRedemptionHints(Decimal.from(55));

      // 30 would be redeemed from otherLiquities[2],
      // 20 from otherLiquities[1],
      // 5 from otherLiquities[0] (as there are 10 for gas compensation in each)
      expect(redemptionHints).to.deep.equal([
        otherLiquities[2].userAddress!,
        liquity.userAddress!,
        Decimal.from("13")
        // (1 ETH * 200 - 5) / (20 - 5) = 13
        // (subtracting 5 for the redemption to otherLiquities[0])
      ]);
    });

    it("should redeem some collateral", async () => {
      const tx = await liquity.redeemCollateral(55, {}, { gasPrice: 0 });

      const receipt = await tx.waitForReceipt();
      assertStrictEquals(receipt.status, "succeeded" as const);

      expect(receipt.details).to.deep.equal({
        attemptedTokenAmount: Decimal.from(55),
        actualTokenAmount: Decimal.from(55),
        collateralReceived: Decimal.from(0.275),
        // fee: Decimal.from("0.084027777777777777")
        fee: Decimal.from("0.042013888888888888")
      });

      const balance = new Decimal(await provider.getBalance(user.getAddress()));
      expect(`${balance}`).to.equal("100.232986111111111112");

      expect(`${await liquity.getQuiBalance()}`).to.equal("45");

      expect(`${(await otherLiquities[0].getTrove()).debt}`).to.equal("15");
      expect((await otherLiquities[1].getTrove()).isEmpty).to.be.true;
      expect((await otherLiquities[2].getTrove()).isEmpty).to.be.true;
    });
  });

  describe("Redemption, gas checks", function () {
    this.timeout("5m");

    before(async function () {
      if (network.name === "dev") {
        // Only about the first 40 accounts work when testing on the dev chain due to a not yet
        // known issue.

        // Since this test needs more than that, let's skip it on dev for now.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean slate
      addresses = addressesOf(await deployAndSetupContracts(deployer, ethers.getContractFactory));
      const otherUsersSubset = otherUsers.slice(0, redeemMaxIterations);
      expect(otherUsersSubset).to.have.length(redeemMaxIterations);

      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 1.1);

      await liquity.openTrove(new Trove({ collateral: 50, debt: 410 }));
      for (let otherLiquity of otherLiquities) {
        await otherLiquity.openTrove(new Trove({ collateral: 1, debt: 11 }));
      }
    });

    it("should redeem using the maximum iterations and almost all gas", async () => {
      const tx = await liquity.redeemCollateral(redeemMaxIterations);

      const receipt = await tx.waitForReceipt();
      assertStrictEquals(receipt.status, "succeeded" as const);

      const gasUsed = receipt.rawReceipt.gasUsed.toNumber();
      // gasUsed is ~half the real used amount because of how refunds work, see:
      // https://ethereum.stackexchange.com/a/859/9205
      expect(gasUsed).to.be.at.least(4950000, "should use close to 10M gas");
    });
  });
});
