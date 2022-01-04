import fs from "fs";

import {
  Decimal,
  Difference,
  LUSD_MINIMUM_DEBT,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

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

  const [deployerLiquity, funderLiquity, frontendLiquity, ...randomLiquities] = await connectUsers([
    deployer,
    funder,
    frontend,
    ...randomUsers
  ]);

  const fixture = await Fixture.setup(
    deployerLiquity,
    funder,
    funderLiquity,
    frontend.address,
    frontendLiquity
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
      const liquity = randomLiquities[i];

      const x = Math.random();

      if (x < 0.5) {
        const trove = await liquity.getTrove();

        if (trove.isEmpty) {
          await fixture.openRandomTrove(user.address, liquity);
        } else {
          if (x < 0.4) {
            await fixture.randomlyAdjustTrove(user.address, liquity, trove);
          } else {
            await fixture.closeTrove(user.address, liquity, trove);
          }
        }
      } else if (x < 0.7) {
        const deposit = await liquity.getStabilityDeposit();

        if (deposit.initialLUSD.isZero || x < 0.6) {
          await fixture.depositRandomAmountInStabilityPool(user.address, liquity);
        } else {
          await fixture.withdrawRandomAmountFromStabilityPool(user.address, liquity, deposit);
        }
      } else if (x < 0.9) {
        const stake = await liquity.getLQTYStake();

        if (stake.stakedLQTY.isZero || x < 0.8) {
          await fixture.stakeRandomAmount(user.address, liquity);
        } else {
          await fixture.unstakeRandomAmount(user.address, liquity, stake);
        }
      } else {
        await fixture.redeemRandomAmount(user.address, liquity);
      }

      // await fixture.sweepLUSD(liquity);
      await fixture.sweepLQTY(liquity);

      const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerLiquity);
      const totalRedistributed = await deployerLiquity.getTotalRedistributed();

      checkTroveOrdering(listOfTroves, totalRedistributed, price, previousListOfTroves);
      await checkPoolBalances(deployerLiquity, listOfTroves, totalRedistributed);

      previousListOfTroves = listOfTroves;
    }

    if (shouldCheckSubgraph) {
      const blockNumber = await provider.getBlockNumber();
      await subgraph.waitForBlock(blockNumber);
      await checkSubgraph(subgraph, deployerLiquity);
    }
  }

  fs.appendFileSync("chaos.csv", fixture.summarizeGasStats());
};

export const order = async () => {
  const [deployerLiquity, funderLiquity] = await connectUsers([deployer, funder]);

  const initialPrice = await deployerLiquity.getPrice();
  // let initialNumberOfTroves = await funderLiquity.getNumberOfTroves();

  let [firstTrove] = await funderLiquity.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    const funderTrove = await funderLiquity.getTrove();

    const targetCollateralRatio = Decimal.max(
      firstTrove.collateralRatio(initialPrice).add(0.00001),
      1.51
    );

    if (funderTrove.isEmpty) {
      const targetTrove = new Trove(
        LUSD_MINIMUM_DEBT.mulDiv(targetCollateralRatio, initialPrice),
        LUSD_MINIMUM_DEBT
      );

      const fees = await funderLiquity.getFees();

      await funderLiquity.openTrove(Trove.recreate(targetTrove, fees.borrowingRate()));
    } else {
      const targetTrove = funderTrove.setCollateral(
        funderTrove.debt.mulDiv(targetCollateralRatio, initialPrice)
      );

      await funderLiquity.adjustTrove(funderTrove.adjustTo(targetTrove));
    }
  }

  [firstTrove] = await funderLiquity.getTroves({
    first: 1,
    sortedBy: "descendingCollateralRatio"
  });

  if (firstTrove.ownerAddress !== funder.address) {
    throw new Error("didn't manage to hoist Funder's Trove to head of SortedTroves");
  }

  await deployerLiquity.setPrice(0.001);

  let numberOfTroves: number;
  while ((numberOfTroves = await funderLiquity.getNumberOfTroves()) > 1) {
    const numberOfTrovesToLiquidate = numberOfTroves > 10 ? 10 : numberOfTroves - 1;

    console.log(`${numberOfTroves} Troves left.`);
    await funderLiquity.liquidateUpTo(numberOfTrovesToLiquidate);
  }

  await deployerLiquity.setPrice(initialPrice);

  if ((await funderLiquity.getNumberOfTroves()) !== 1) {
    throw new Error("didn't manage to liquidate every Trove");
  }

  const funderTrove = await funderLiquity.getTrove();
  const total = await funderLiquity.getTotal();

  const collateralDifference = Difference.between(total.collateral, funderTrove.collateral);
  const debtDifference = Difference.between(total.debt, funderTrove.debt);

  console.log();
  console.log("Discrepancies:");
  console.log(`Collateral: ${collateralDifference}`);
  console.log(`Debt: ${debtDifference}`);
};
