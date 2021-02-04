import chai, { expect, assert } from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiSpies from "chai-spies";
import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";
import { ethers, network, deployLiquity } from "hardhat";

import { Decimal, Decimalish } from "@liquity/decimal";
import {
  Trove,
  StabilityDeposit,
  LiquityReceipt,
  SuccessfulReceipt,
  SentLiquityTransaction,
  ReadableLiquity,
  TroveCreationParams,
  Fees,
  LUSD_LIQUIDATION_RESERVE,
  MAXIMUM_BORROWING_RATE,
  LiquityStore
} from "@liquity/lib-base";

import { HintHelpers } from "../types";

import { LiquityConnection, _connectToDeployment, _LiquityDeploymentJSON } from "../src/contracts";

import {
  PopulatableEthersLiquity,
  PopulatedEthersLiquityTransaction,
  _redeemMaxIterations
} from "../src/PopulatableEthersLiquity";

import { EthersLiquity } from "../src/EthersLiquity";

const provider = ethers.provider;

chai.use(chaiAsPromised);
chai.use(chaiSpies);

const connectToDeployment = (deployment: _LiquityDeploymentJSON, signer: Signer) =>
  EthersLiquity._from(_connectToDeployment(deployment, signer));

const baseRate = Fees.prototype.baseRate;
let cumulativeTimeJumpSeconds = 0;

// Patch baseRate to work with increaseTime
Fees.prototype.baseRate = function (when) {
  return baseRate.call(this, new Date(when.getTime() + cumulativeTimeJumpSeconds * 1000));
};

const increaseTime = async (timeJumpSeconds: number) => {
  await provider.send("evm_increaseTime", [timeJumpSeconds]);
  cumulativeTimeJumpSeconds += timeJumpSeconds;
};

function assertStrictEqual<T, U extends T>(
  actual: T,
  expected: U,
  message?: string
): asserts actual is U {
  assert.strictEqual(actual, expected, message);
}

function assertDefined<T>(actual: T | undefined): asserts actual is T {
  assert(actual !== undefined);
}

const waitForSuccess = async <T extends LiquityReceipt>(
  tx: Promise<SentLiquityTransaction<unknown, T>>
) => {
  const receipt = await (await tx).waitForReceipt();
  assertStrictEqual(receipt.status, "succeeded" as const);

  return receipt as Extract<T, SuccessfulReceipt>;
};

// TODO make the testcases isolated

describe("EthersLiquity", () => {
  let deployer: Signer;
  let funder: Signer;
  let user: Signer;
  let otherUsers: Signer[];

  let deployment: _LiquityDeploymentJSON;

  let deployerLiquity: EthersLiquity;
  let liquity: EthersLiquity;
  let otherLiquities: EthersLiquity[];

  const connectUsers = (users: Signer[]) =>
    Promise.all(users.map(user => connectToDeployment(deployment, user)));

  const openTroves = (users: Signer[], params: TroveCreationParams<Decimalish>[]) =>
    params
      .map((params, i) => () =>
        Promise.all([
          connectToDeployment(deployment, users[i]),
          sendTo(users[i], params.depositCollateral).then(tx => tx.wait())
        ]).then(async ([liquity]) => {
          await liquity.openTrove(params, { gasPrice: 0 });
        })
      )
      .reduce((a, b) => a.then(b), Promise.resolve());

  const sendTo = (user: Signer, value: Decimalish, nonce?: number) =>
    funder.sendTransaction({
      to: user.getAddress(),
      value: Decimal.from(value).bigNumber,
      nonce
    });

  const sendToEach = async (users: Signer[], value: Decimalish) => {
    const txCount = await provider.getTransactionCount(funder.getAddress());
    const txs = await Promise.all(users.map((user, i) => sendTo(user, value, txCount + i)));

    // Wait for the last tx to be mined.
    await txs[txs.length - 1].wait();
  };

  before(async () => {
    [deployer, funder, user, ...otherUsers] = await ethers.getSigners();
    deployment = await deployLiquity(deployer);

    liquity = await connectToDeployment(deployment, user);
    expect(liquity).to.be.an.instanceOf(EthersLiquity);
  });

  // Always setup same initial balance for user
  beforeEach(async () => {
    const targetBalance = Decimal.from(100).bigNumber;
    const balance = await user.getBalance();
    const gasPrice = 0;

    if (balance.eq(targetBalance)) {
      return;
    }

    if (balance.gt(targetBalance)) {
      await user.sendTransaction({
        to: funder.getAddress(),
        value: balance.sub(targetBalance),
        gasPrice
      });
    } else {
      await funder.sendTransaction({
        to: user.getAddress(),
        value: targetBalance.sub(balance),
        gasPrice
      });
    }

    expect(`${await user.getBalance()}`).to.equal(`${targetBalance}`);
  });

  it("should get the price", async () => {
    const price = await liquity.getPrice();
    expect(price).to.be.an.instanceOf(Decimal);
  });

  describe("findHintForCollateralRatio", () => {
    it("should pick the closest approx hint", async () => {
      type Resolved<T> = T extends Promise<infer U> ? U : never;
      type ApproxHint = Resolved<ReturnType<HintHelpers["getApproxHint"]>>;

      const fakeHints: ApproxHint[] = [
        { diff: BigNumber.from(3), hintAddress: "alice", latestRandomSeed: BigNumber.from(1111) },
        { diff: BigNumber.from(4), hintAddress: "bob", latestRandomSeed: BigNumber.from(2222) },
        { diff: BigNumber.from(1), hintAddress: "carol", latestRandomSeed: BigNumber.from(3333) },
        { diff: BigNumber.from(2), hintAddress: "dennis", latestRandomSeed: BigNumber.from(4444) }
      ];

      const borrowerOperations = {
        estimateAndPopulate: {
          openTrove: () => ({})
        }
      };

      const hintHelpers = chai.spy.interface({
        getApproxHint: () => Promise.resolve(fakeHints.shift())
      });

      const sortedTroves = chai.spy.interface({
        findInsertPosition: () => Promise.resolve(["fake insert position"])
      });

      const fakeConnection = {
        signerOrProvider: user,
        _contracts: {
          borrowerOperations,
          hintHelpers,
          sortedTroves
        }
      };

      const fakeLiquity = new PopulatableEthersLiquity(
        (fakeConnection as unknown) as LiquityConnection,
        (undefined as unknown) as ReadableLiquity,
        {
          state: {
            numberOfTroves: 1000000, // 10 * sqrt(1M) / 2500 = 4 expected getApproxHint calls
            fees: new Fees(new Date(), 0, 0.99, 1)
          }
        } as LiquityStore
      );

      const nominalCollateralRatio = Decimal.ONE.div(1.0025);

      const params = { depositCollateral: 1, borrowLUSD: 50 };
      const trove = Trove.create(params);
      expect(`${trove._nominalCollateralRatio}`).to.equal(`${nominalCollateralRatio}`);

      await fakeLiquity.openTrove(params);

      expect(hintHelpers.getApproxHint).to.have.been.called.exactly(4);
      expect(hintHelpers.getApproxHint).to.have.been.called.with(nominalCollateralRatio.bigNumber);

      // returned latestRandomSeed should be passed back on the next call
      expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(1111));
      expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(2222));
      expect(hintHelpers.getApproxHint).to.have.been.called.with(BigNumber.from(3333));

      expect(sortedTroves.findInsertPosition).to.have.been.called.once;
      expect(sortedTroves.findInsertPosition).to.have.been.called.with(
        nominalCollateralRatio.bigNumber,
        "carol"
      );
    });
  });

  describe("Trove", () => {
    it("should have no Trove initially", async () => {
      const trove = await liquity.getTrove();
      expect(trove.isEmpty).to.be.true;
    });

    it("should fail to create an Trove without collateral", async () => {
      await expect(liquity.openTrove({ depositCollateral: 0 })).to.eventually.be.rejected;
    });

    it("should fail to create a Trove with too little collateral", async () => {
      await expect(liquity.openTrove({ depositCollateral: 0.05 })).to.eventually.be.rejected;
    });

    const withoutBorrowing = { depositCollateral: 1 };

    it("should create a Trove without borrowing", async () => {
      const { newTrove } = await liquity.openTrove(withoutBorrowing);
      expect(newTrove).to.deep.equal(Trove.create(withoutBorrowing));

      const trove = await liquity.getTrove();
      expect(trove).to.deep.equal(newTrove);
    });

    it("should withdraw some of the collateral", async () => {
      const { newTrove } = await liquity.withdrawCollateral(0.5);

      expect(newTrove).to.deep.equal(
        Trove.create(withoutBorrowing).adjust({ withdrawCollateral: 0.5 })
      );
    });

    it("should fail to close the Trove when there are no other Troves", async () => {
      const numberOfTroves = await liquity.getNumberOfTroves();
      expect(numberOfTroves).to.equal(1);

      expect(liquity.closeTrove()).to.eventually.be.rejected;
    });

    it("should close the Trove after another user creates a Trove", async () => {
      const funderLiquity = await connectToDeployment(deployment, funder);
      await funderLiquity.openTrove({ depositCollateral: 1 });

      const { params } = await liquity.closeTrove();
      expect(params).to.deep.equal({ withdrawCollateral: Decimal.from(0.5) });

      const trove = await liquity.getTrove();
      expect(trove.isEmpty).to.be.true;
    });

    const withSomeBorrowing = { depositCollateral: 1, borrowLUSD: 90 };

    it("should create a Trove with some borrowing", async () => {
      const { newTrove } = await liquity.openTrove(withSomeBorrowing);
      expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing));
    });

    it("should fail to withdraw all the collateral while the Trove has debt", async () => {
      const trove = await liquity.getTrove();

      await expect(liquity.withdrawCollateral(trove.collateral)).to.eventually.be.rejected;
    });

    const repaySomeDebt = { repayLUSD: 10 };

    it("should repay some debt", async () => {
      const { newTrove } = await liquity.repayLUSD(repaySomeDebt.repayLUSD);
      expect(newTrove).to.deep.equal(Trove.create(withSomeBorrowing).adjust(repaySomeDebt));
    });

    const borrowSomeMore = { borrowLUSD: 20 };

    it("should borrow some more", async () => {
      const { newTrove } = await liquity.borrowLUSD(borrowSomeMore.borrowLUSD);
      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing).adjust(repaySomeDebt).adjust(borrowSomeMore)
      );
    });

    const depositMoreCollateral = { depositCollateral: 1 };

    it("should deposit more collateral", async () => {
      const { newTrove } = await liquity.depositCollateral(depositMoreCollateral.depositCollateral);
      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
      );
    });

    const repayAndWithdraw = { repayLUSD: 60, withdrawCollateral: 0.5 };

    it("should repay some debt and withdraw some collateral at the same time", async () => {
      const { newTrove } = await liquity.adjustTrove(repayAndWithdraw, { gasPrice: 0 });

      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
      );

      const ethBalance = new Decimal(await user.getBalance());
      expect(`${ethBalance}`).to.equal("100.5");
    });

    const borrowAndDeposit = { borrowLUSD: 60, depositCollateral: 0.5 };

    it("should borrow more and deposit some collateral at the same time", async () => {
      const { newTrove } = await liquity.adjustTrove(borrowAndDeposit, { gasPrice: 0 });

      expect(newTrove).to.deep.equal(
        Trove.create(withSomeBorrowing)
          .adjust(repaySomeDebt)
          .adjust(borrowSomeMore)
          .adjust(depositMoreCollateral)
          .adjust(repayAndWithdraw)
          .adjust(borrowAndDeposit)
      );

      const ethBalance = new Decimal(await user.getBalance());
      expect(`${ethBalance}`).to.equal("99.5");
    });
  });

  describe("SendableEthersLiquity", () => {
    it("should parse failed transactions without throwing", async () => {
      // By passing a gasLimit, we avoid automatic use of estimateGas which would throw
      const tx = await liquity.send.openTrove({ depositCollateral: 0.01 }, { gasLimit: 1e6 });
      const { status } = await tx.waitForReceipt();

      expect(status).to.equal("failed");
    });
  });

  describe("Frontend", () => {
    it("should have no frontend initially", async () => {
      const frontend = await liquity.getFrontendStatus();

      assertStrictEqual(frontend.status, "unregistered" as const);
    });

    it("should register a frontend", async () => {
      await liquity.registerFrontend(0.75);
    });

    it("should have a frontend now", async () => {
      const frontend = await liquity.getFrontendStatus();

      assertStrictEqual(frontend.status, "registered" as const);
      expect(`${frontend.kickbackRate}`).to.equal("0.75");
    });
  });

  describe("StabilityPool", () => {
    before(async () => {
      deployment = await deployLiquity(deployer);

      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsers.slice(0, 1)
      ]);

      await funder.sendTransaction({
        to: otherUsers[0].getAddress(),
        value: Decimal.from(1.1).bigNumber
      });
    });

    const initialTroveOfDepositor = Trove.create({ depositCollateral: 2, borrowLUSD: 90 });
    const smallStabilityDeposit = Decimal.from(10);

    it("should make a small stability deposit", async () => {
      const { newTrove } = await liquity.openTrove(Trove.recreate(initialTroveOfDepositor));
      expect(newTrove).to.deep.equal(initialTroveOfDepositor);

      const details = await liquity.depositLUSDInStabilityPool(smallStabilityDeposit);

      expect(details).to.deep.equal({
        lusdLoss: Decimal.from(0),
        newLUSDDeposit: smallStabilityDeposit,
        collateralGain: Decimal.from(0),
        lqtyReward: Decimal.from(0),

        change: {
          depositLUSD: smallStabilityDeposit
        }
      });
    });

    const troveWithVeryLowICR = Trove.create({ depositCollateral: 1, borrowLUSD: 125 });

    it("other user should make a Trove with very low ICR", async () => {
      const { newTrove } = await otherLiquities[0].openTrove(Trove.recreate(troveWithVeryLowICR));

      const price = await liquity.getPrice();
      expect(Number(`${newTrove.collateralRatio(price)}`)).to.be.below(1.15);
    });

    const dippedPrice = Decimal.from(190);

    it("the price should take a dip", async () => {
      await deployerLiquity.setPrice(dippedPrice);

      const price = await liquity.getPrice();
      expect(`${price}`).to.equal(`${dippedPrice}`);
    });

    it("should liquidate other user's Trove", async () => {
      const details = await liquity.liquidateUpTo(1);

      expect(details).to.deep.equal({
        liquidatedAddresses: [await otherUsers[0].getAddress()],

        collateralGasCompensation: troveWithVeryLowICR.collateral.mul(0.005), // 0.5%
        lusdGasCompensation: LUSD_LIQUIDATION_RESERVE,

        totalLiquidated: new Trove(
          troveWithVeryLowICR.collateral.mul(0.995), // -0.5% gas compensation
          troveWithVeryLowICR.debt
        )
      });

      const otherTrove = await otherLiquities[0].getTrove();
      expect(otherTrove.isEmpty).to.be.true;
    });

    it("should have a depleted stability deposit and some collateral gain", async () => {
      const deposit = await liquity.getStabilityDeposit();

      expect(deposit).to.deep.equal(
        new StabilityDeposit(
          smallStabilityDeposit,
          Decimal.ZERO,
          troveWithVeryLowICR.collateral
            .mul(0.995) // -0.5% gas compensation
            .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
            .sub("0.000000000000000003") // tiny imprecision
        )
      );
    });

    it("the Trove should have received some liquidation shares", async () => {
      const trove = await liquity.getTrove();

      expect(trove).to.deep.equal(
        initialTroveOfDepositor
          .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            troveWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .mulDiv(troveWithVeryLowICR.debt.sub(smallStabilityDeposit), troveWithVeryLowICR.debt)
          )
      );
    });

    it("total should equal the Trove", async () => {
      const trove = await liquity.getTrove();

      const numberOfTroves = await liquity.getNumberOfTroves();
      expect(numberOfTroves).to.equal(1);

      const total = await liquity.getTotal();
      expect(total).to.deep.equal(
        trove.addCollateral("0.000000000000000001") // tiny imprecision
      );
    });

    it("should transfer the gains to the Trove", async () => {
      const details = await liquity.transferCollateralGainToTrove();

      expect(details).to.deep.equal({
        lusdLoss: smallStabilityDeposit,
        newLUSDDeposit: Decimal.ZERO,
        lqtyReward: Decimal.ZERO,

        collateralGain: troveWithVeryLowICR.collateral
          .mul(0.995) // -0.5% gas compensation
          .mulDiv(smallStabilityDeposit, troveWithVeryLowICR.debt)
          .sub("0.000000000000000003"), // tiny imprecision

        newTrove: initialTroveOfDepositor
          .addDebt(troveWithVeryLowICR.debt.sub(smallStabilityDeposit))
          .addCollateral(
            troveWithVeryLowICR.collateral
              .mul(0.995) // -0.5% gas compensation
              .sub("0.000000000000000004") // tiny imprecision
          )
      });

      const deposit = await liquity.getStabilityDeposit();
      expect(deposit.isEmpty).to.be.true;
    });

    describe("when people overstay", () => {
      before(async () => {
        // Deploy new instances of the contracts, for a clean slate
        deployment = await deployLiquity(deployer);

        const otherUsersSubset = otherUsers.slice(0, 5);
        [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
          deployer,
          user,
          ...otherUsersSubset
        ]);

        await sendToEach(otherUsersSubset, 2.1);

        let price = Decimal.from(200);
        await deployerLiquity.setPrice(price);

        // Use this account to print LUSD
        await liquity.openTrove({ depositCollateral: 10, borrowLUSD: 500 });

        // otherLiquities[0-2] will be independent stability depositors
        await liquity.sendLUSD(await otherUsers[0].getAddress(), 300);
        await liquity.sendLUSD(await otherUsers[1].getAddress(), 100);
        await liquity.sendLUSD(await otherUsers[2].getAddress(), 100);

        // otherLiquities[3-4] will be Trove owners whose Troves get liquidated
        await otherLiquities[3].openTrove({ depositCollateral: 2, borrowLUSD: 290 });
        await otherLiquities[4].openTrove({ depositCollateral: 2, borrowLUSD: 290 });

        await otherLiquities[0].depositLUSDInStabilityPool(300);
        await otherLiquities[1].depositLUSDInStabilityPool(100);
        // otherLiquities[2] doesn't deposit yet

        // Tank the price so we can liquidate
        price = Decimal.from(150);
        await deployerLiquity.setPrice(price);

        // Liquidate first victim
        await liquity.liquidate(await otherUsers[3].getAddress());
        expect((await otherLiquities[3].getTrove()).isEmpty).to.be.true;

        // Now otherLiquities[2] makes their deposit too
        await otherLiquities[2].depositLUSDInStabilityPool(100);

        // Liquidate second victim
        await liquity.liquidate(await otherUsers[4].getAddress());
        expect((await otherLiquities[4].getTrove()).isEmpty).to.be.true;

        // Stability Pool is now empty
        expect(`${await liquity.getLUSDInStabilityPool()}`).to.equal("0");
      });

      it("should still be able to withdraw remaining deposit", async () => {
        for (const l of [otherLiquities[0], otherLiquities[1], otherLiquities[2]]) {
          const stabilityDeposit = await l.getStabilityDeposit();
          await l.withdrawLUSDFromStabilityPool(stabilityDeposit.currentLUSD);
        }
      });
    });
  });

  describe("Redemption", () => {
    const troveCreations = [
      { depositCollateral: 20, borrowLUSD: 100 },
      { depositCollateral: 1, borrowLUSD: 10 },
      { depositCollateral: 1, borrowLUSD: 20 },
      { depositCollateral: 1, borrowLUSD: 30 }
    ];

    before(async () => {
      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployLiquity(deployer);

      const otherUsersSubset = otherUsers.slice(0, 3);
      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 1.1);

      await liquity.openTrove(troveCreations[0]);
      await otherLiquities[0].openTrove(troveCreations[1]);
      await otherLiquities[1].openTrove(troveCreations[2]);
      await otherLiquities[2].openTrove(troveCreations[3]);
    });

    after(() => {
      cumulativeTimeJumpSeconds = 0;
    });

    it("should fail to redeem during the bootstrap phase", async () => {
      await expect(liquity.redeemLUSD(55, { gasPrice: 0 })).to.eventually.be.rejected;
    });

    const someLUSD = Decimal.from(55);

    it("should redeem some LUSD after the bootstrap phase", async () => {
      // Fast-forward 15 days
      increaseTime(60 * 60 * 24 * 15);

      expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");
      expect(`${await otherLiquities[1].getCollateralSurplusBalance()}`).to.equal("0");
      expect(`${await otherLiquities[2].getCollateralSurplusBalance()}`).to.equal("0");

      const expectedTotal = troveCreations
        .map(params => Trove.create(params))
        .reduce((a, b) => a.add(b));

      const total = await liquity.getTotal();
      expect(total).to.deep.equal(expectedTotal);

      const expectedDetails = {
        attemptedLUSDAmount: someLUSD,
        actualLUSDAmount: someLUSD,
        collateralTaken: someLUSD.div(200),
        fee: new Fees(new Date(), 0, 0.99, 2)
          .redemptionRate(someLUSD.div(total.debt))
          .mul(someLUSD.div(200))
      };

      const details = await liquity.redeemLUSD(someLUSD, { gasPrice: 0 });
      expect(details).to.deep.equal(expectedDetails);

      const balance = new Decimal(await provider.getBalance(user.getAddress()));
      expect(`${balance}`).to.equal(
        `${expectedDetails.collateralTaken.sub(expectedDetails.fee).add(100)}`
      );

      expect(`${await liquity.getLUSDBalance()}`).to.equal("45");

      expect(`${(await otherLiquities[0].getTrove()).debt}`).to.equal(
        `${Trove.create(troveCreations[1]).debt.sub(
          someLUSD
            .sub(Trove.create(troveCreations[2]).netDebt)
            .sub(Trove.create(troveCreations[3]).netDebt)
        )}`
      );

      expect((await otherLiquities[1].getTrove()).isEmpty).to.be.true;
      expect((await otherLiquities[2].getTrove()).isEmpty).to.be.true;
    });

    it("should claim the collateral surplus after redemption", async () => {
      const balanceBefore1 = await provider.getBalance(otherUsers[1].getAddress());
      const balanceBefore2 = await provider.getBalance(otherUsers[2].getAddress());

      expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");

      const surplus1 = await otherLiquities[1].getCollateralSurplusBalance();
      const trove1 = Trove.create(troveCreations[2]);
      expect(`${surplus1}`).to.equal(`${trove1.collateral.sub(trove1.netDebt.div(200))}`);

      const surplus2 = await otherLiquities[2].getCollateralSurplusBalance();
      const trove2 = Trove.create(troveCreations[3]);
      expect(`${surplus2}`).to.equal(`${trove2.collateral.sub(trove2.netDebt.div(200))}`);

      await otherLiquities[1].claimCollateralSurplus({ gasPrice: 0 });
      await otherLiquities[2].claimCollateralSurplus({ gasPrice: 0 });

      expect(`${await otherLiquities[0].getCollateralSurplusBalance()}`).to.equal("0");
      expect(`${await otherLiquities[1].getCollateralSurplusBalance()}`).to.equal("0");
      expect(`${await otherLiquities[2].getCollateralSurplusBalance()}`).to.equal("0");

      const balanceAfter1 = await provider.getBalance(otherUsers[1].getAddress());
      const balanceAfter2 = await provider.getBalance(otherUsers[2].getAddress());
      expect(balanceAfter1.toString()).to.equal(balanceBefore1.add(surplus1.bigNumber).toString());
      expect(balanceAfter2.toString()).to.equal(balanceBefore2.add(surplus2.bigNumber).toString());
    });

    it("borrowing rate should be maxed out now", async () => {
      const borrowLUSD = Decimal.from(10);

      const { fee, newTrove } = await liquity.borrowLUSD(borrowLUSD);
      expect(`${fee}`).to.equal(`${borrowLUSD.mul(MAXIMUM_BORROWING_RATE)}`);

      expect(newTrove).to.deep.equal(
        Trove.create(troveCreations[0]).adjust({ borrowLUSD }, MAXIMUM_BORROWING_RATE)
      );
    });
  });

  describe("Redemption (gas checks)", function () {
    this.timeout("5m");

    before(async function () {
      if (network.name === "dev") {
        // Only about the first 40 accounts work when testing on the dev chain due to a not yet
        // known issue.

        // Since this test needs more than that, let's skip it on dev for now.
        this.skip();
      }

      // Deploy new instances of the contracts, for a clean slate
      deployment = await deployLiquity(deployer);
      const otherUsersSubset = otherUsers.slice(0, _redeemMaxIterations);
      expect(otherUsersSubset).to.have.length(_redeemMaxIterations);

      [deployerLiquity, liquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        ...otherUsersSubset
      ]);

      await sendToEach(otherUsersSubset, 1.1);

      await liquity.openTrove({ depositCollateral: 50, borrowLUSD: 400 });
      for (const otherLiquity of otherLiquities) {
        await otherLiquity.openTrove({ depositCollateral: 1, borrowLUSD: 1 });
      }

      increaseTime(60 * 60 * 24 * 15);
    });

    after(() => {
      cumulativeTimeJumpSeconds = 0;
    });

    it("should redeem using the maximum iterations and almost all gas", async () => {
      const { rawReceipt } = await waitForSuccess(liquity.send.redeemLUSD(_redeemMaxIterations));

      const gasUsed = rawReceipt.gasUsed.toNumber();
      // gasUsed is ~half the real used amount because of how refunds work, see:
      // https://ethereum.stackexchange.com/a/859/9205
      expect(gasUsed).to.be.at.least(4900000, "should use close to 10M gas");
    });
  });

  describe("Gas estimation", () => {
    const troveWithICRBetween = (a: Trove, b: Trove) => a.add(b).multiply(0.5);

    let rudeUser: Signer;
    let fiveOtherUsers: Signer[];
    let rudeLiquity: EthersLiquity;

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployLiquity(deployer);

      [rudeUser, ...fiveOtherUsers] = otherUsers.slice(0, 6);

      [deployerLiquity, liquity, rudeLiquity, ...otherLiquities] = await connectUsers([
        deployer,
        user,
        rudeUser,
        ...fiveOtherUsers
      ]);

      await openTroves(fiveOtherUsers, [
        { depositCollateral: 1, borrowLUSD: 40 },
        { depositCollateral: 1, borrowLUSD: 50 },
        { depositCollateral: 1, borrowLUSD: 60 },
        { depositCollateral: 1, borrowLUSD: 70 },
        { depositCollateral: 1, borrowLUSD: 80 }
      ]);

      increaseTime(60 * 60 * 24 * 15);
    });

    after(() => {
      cumulativeTimeJumpSeconds = 0;
    });

    it("should include enough gas for updating lastFeeOperationTime", async () => {
      await liquity.openTrove({ depositCollateral: 1, borrowLUSD: 90 });

      // We just updated lastFeeOperationTime, so this won't anticipate having to update that
      // during estimateGas
      const tx = await liquity.populate.redeemLUSD(1);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // Fast-forward 2 minutes.
      await increaseTime(120);

      // Required gas has just went up.
      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();
      expect(gasIncrease).to.be.within(5000, 10000);

      // This will now have to update lastFeeOperationTime
      await waitForSuccess(tx.send());

      // Decay base-rate back to 0
      await increaseTime(100000000);
    });

    it("should include enough gas for one extra traversal", async () => {
      const troves = (await liquity.getLastTroves(0, 10)).map(([, t]) => t);

      const trove = await liquity.getTrove();
      const newTrove = troveWithICRBetween(troves[3], troves[4]);

      // First, we want to test a non-borrowing case, to make sure we're not passing due to any
      // extra gas we add to cover a potential lastFeeOperationTime update
      const adjustment = trove.adjustTo(newTrove);
      expect(adjustment.borrowLUSD).to.be.undefined;

      const tx = await liquity.populate.adjustTrove(adjustment);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // A terribly rude user interferes
      const rudeTrove = newTrove.addDebt(1);
      const rudeCreation = Trove.recreate(rudeTrove);
      await openTroves([rudeUser], [rudeCreation]);

      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(10000, 25000);

      assertDefined(rudeCreation.borrowLUSD);
      const lusdShortage = rudeTrove.debt.sub(rudeCreation.borrowLUSD);

      await liquity.sendLUSD(await rudeUser.getAddress(), lusdShortage);
      await rudeLiquity.closeTrove({ gasPrice: 0 });
    });

    it("should include enough gas for both when borrowing", async () => {
      const troves = (await liquity.getLastTroves(0, 10)).map(([, t]) => t);
      const trove = await liquity.getTrove();
      const newTrove = troveWithICRBetween(troves[1], troves[2]);

      // Make sure we're borrowing
      const adjustment = trove.adjustTo(newTrove);
      expect(adjustment.borrowLUSD).to.not.be.undefined;

      const tx = await liquity.populate.adjustTrove(adjustment);
      const originalGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);

      // A terribly rude user interferes again
      await openTroves([rudeUser], [Trove.recreate(newTrove.addDebt(1))]);

      // On top of that, we'll need to update lastFeeOperationTime
      await increaseTime(120);

      const newGasEstimate = await provider.estimateGas(tx.rawPopulatedTransaction);
      const gasIncrease = newGasEstimate.sub(originalGasEstimate).toNumber();

      await waitForSuccess(tx.send());
      expect(gasIncrease).to.be.within(15000, 30000);
    });
  });

  describe("Gas estimation (LQTY issuance)", () => {
    const estimate = (tx: PopulatedEthersLiquityTransaction) =>
      provider.estimateGas(tx.rawPopulatedTransaction);

    before(async function () {
      if (network.name !== "hardhat") {
        this.skip();
      }

      deployment = await deployLiquity(deployer);
      [deployerLiquity, liquity] = await connectUsers([deployer, user]);
    });

    it("should include enough gas for issuing LQTY", async function () {
      this.timeout("1m");

      await liquity.openTrove({ depositCollateral: 1, borrowLUSD: 20 });
      await liquity.depositLUSDInStabilityPool(19);

      await increaseTime(60);

      // This will issue LQTY for the first time ever. That uses a whole lotta gas, and we don't
      // want to pack any extra gas to prepare for this case specifically, because it only happens
      // once.
      await liquity.withdrawGainsFromStabilityPool();

      const claim = await liquity.populate.withdrawGainsFromStabilityPool();
      const deposit = await liquity.populate.depositLUSDInStabilityPool(1);
      const withdraw = await liquity.populate.withdrawLUSDFromStabilityPool(1);

      for (let i = 0; i < 5; ++i) {
        for (const tx of [claim, deposit, withdraw]) {
          const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
          const requiredGas = (await estimate(tx)).toNumber();

          assertDefined(gasLimit);
          expect(requiredGas).to.be.at.most(gasLimit);
        }

        await increaseTime(60);
      }

      await waitForSuccess(claim.send());

      const creation = Trove.recreate(new Trove(Decimal.from(1), Decimal.from(181)));
      assertDefined(creation.borrowLUSD);

      await deployerLiquity.openTrove(creation);
      await deployerLiquity.depositLUSDInStabilityPool(creation.borrowLUSD);
      await deployerLiquity.setPrice(199);

      const liquidateTarget = await liquity.populate.liquidate(await deployer.getAddress());
      const liquidateMultiple = await liquity.populate.liquidateUpTo(40);

      for (let i = 0; i < 5; ++i) {
        for (const tx of [liquidateTarget, liquidateMultiple]) {
          const gasLimit = tx.rawPopulatedTransaction.gasLimit?.toNumber();
          const requiredGas = (await estimate(tx)).toNumber();

          assertDefined(gasLimit);
          expect(requiredGas).to.be.at.most(gasLimit);
        }

        await increaseTime(60);
      }

      await waitForSuccess(liquidateMultiple.send());
    });
  });
});
