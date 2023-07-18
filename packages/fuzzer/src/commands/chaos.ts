import fs from "fs";

import {
  Decimal,
  Difference,
  XBRL_MINIMUM_DEBT,
  Trove,
  TroveWithPendingRedistribution
} from "@stabilio/lib-base";

import { Fixture } from "../fixture";
import { deployer, funder, provider, subgraph } from "../globals";

import {
  checkPoolBalances,
  checkSubgraph,
  checkTroveOrdering,
  connectUsers,
  createRandomWallets,
  getListOfTrovesBeforeRedistribution,
  shortenAddress
} from "../utils";

export interface ChaosParams {
  rounds: number;
  users: number;
  subgraph: boolean;
}

export const chaos = async ({
  rounds: numberOfRounds,
  users: numberOfUsers,
  subgraph: shouldCheckSubgraph
}: ChaosParams) => {
  const [frontend, ...randomUsers] = createRandomWallets(numberOfUsers + 1, provider);

  const [deployerStabilio, funderStabilio, frontendStabilio, ...randomLiquities] = await connectUsers([
    deployer,
    funder,
    frontend,
    ...randomUsers
  ]);

  const fixture = await Fixture.setup(
    deployerStabilio,
    funder,
    funderStabilio,
    frontend.address,
    frontendStabilio
  );

  let previousListOfTroves: TroveWithPendingRedistribution[] | undefined = undefined;

  console.log();
  console.log("// Keys");
  console.log(`[frontend]: ${frontend.privateKey}`);
  randomUsers.forEach(user => console.log(`[${shortenAddress(user.address)}]: ${user.privateKey}`));

  for (let i = 1; i <= numberOfRounds; ++i) {
    console.log();
    console.log(`// Round #${i}`);

    const price = await fixture.setRandomPrice();
    await fixture.liquidateRandomNumberOfTroves(price);

    for (let i = 0; i < randomUsers.length; ++i) {
      const user = randomUsers[i];
      const stabilio = randomLiquities[i];

      const x = Math.random();

      if (x < 0.5) {
        const trove = await stabilio.getTrove();

        if (trove.isEmpty) {
          await fixture.openRandomTrove(user.address, stabilio);
        } else {
          if (x < 0.4) {
            await fixture.randomlyAdjustTrove(user.address, stabilio, trove);
          } else {
            await fixture.closeTrove(user.address, stabilio, trove);
          }
        }
      } else if (x < 0.7) {
        const deposit = await stabilio.getStabilityDeposit();

        if (deposit.initialXBRL.isZero || x < 0.6) {
          await fixture.depositRandomAmountInStabilityPool(user.address, stabilio);
        } else {
          await fixture.withdrawRandomAmountFromStabilityPool(user.address, stabilio, deposit);
        }
      } else if (x < 0.9) {
        const stake = await stabilio.getSTBLStake();

        if (stake.stakedSTBL.isZero || x < 0.8) {
          await fixture.stakeRandomAmount(user.address, stabilio);
        } else {
          await fixture.unstakeRandomAmount(user.address, stabilio, stake);
        }
      } else {
        await fixture.redeemRandomAmount(user.address, stabilio);
      }

      // await fixture.sweepXBRL(stabilio);
      await fixture.sweepSTBL(stabilio);

      const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerStabilio);
      const totalRedistributed = await deployerStabilio.getTotalRedistributed();

      checkTroveOrdering(listOfTroves, totalRedistributed, price, previousListOfTroves);
      await checkPoolBalances(deployerStabilio, listOfTroves, totalRedistributed);

      previousListOfTroves = listOfTroves;
    }

    if (shouldCheckSubgraph) {
      const blockNumber = await provider.getBlockNumber();
      await subgraph.waitForBlock(blockNumber);
      await checkSubgraph(subgraph, deployerStabilio);
    }
  }

  fs.appendFileSync("chaos.csv", fixture.summarizeGasStats());
};

export const order = async () => {
  const [deployerStabilio, funderStabilio] = await connectUsers([deployer, funder]);

  const initialPrice = await deployerStabilio.getPrice();
  // let initialNumberOfTroves = await funderStabilio.getNumberOfTroves();

  let [firstTrove] = await funderStabilio.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    const funderTrove = await funderStabilio.getTrove();

    const targetCollateralRatio = Decimal.max(
      firstTrove.collateralRatio(initialPrice).add(0.00001),
      1.51
    );

    if (funderTrove.isEmpty) {
      const targetTrove = new Trove(
        XBRL_MINIMUM_DEBT.mulDiv(targetCollateralRatio, initialPrice),
        XBRL_MINIMUM_DEBT
      );

      const fees = await funderStabilio.getFees();

      await funderStabilio.openTrove(Trove.recreate(targetTrove, fees.borrowingRate()));
    } else {
      const targetTrove = funderTrove.setCollateral(
        funderTrove.debt.mulDiv(targetCollateralRatio, initialPrice)
      );

      await funderStabilio.adjustTrove(funderTrove.adjustTo(targetTrove));
    }
  }

  [firstTrove] = await funderStabilio.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    throw new Error("didn't manage to hoist Funder's Trove to head of SortedTroves");
  }

  await deployerStabilio.setPrice(0.001);

  let numberOfTroves: number;
  while ((numberOfTroves = await funderStabilio.getNumberOfTroves()) > 1) {
    const numberOfTrovesToLiquidate = numberOfTroves > 10 ? 10 : numberOfTroves - 1;

    console.log(`${numberOfTroves} Troves left.`);
    await funderStabilio.liquidateUpTo(numberOfTrovesToLiquidate);
  }

  await deployerStabilio.setPrice(initialPrice);

  if ((await funderStabilio.getNumberOfTroves()) !== 1) {
    throw new Error("didn't manage to liquidate every Trove");
  }

  const funderTrove = await funderStabilio.getTrove();
  const total = await funderStabilio.getTotal();

  const collateralDifference = Difference.between(total.collateral, funderTrove.collateral);
  const debtDifference = Difference.between(total.debt, funderTrove.debt);

  console.log();
  console.log("Discrepancies:");
  console.log(`Collateral: ${collateralDifference}`);
  console.log(`Debt: ${debtDifference}`);
};
