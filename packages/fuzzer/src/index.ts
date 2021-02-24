import yargs from "yargs";
import fs from "fs";
import dotenv from "dotenv";
import "colors";

import { Wallet } from "@ethersproject/wallet";
import { JsonRpcProvider } from "@ethersproject/providers";

import {
  Decimal,
  Difference,
  LUSD_LIQUIDATION_RESERVE,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

import { EthersLiquity as Liquity } from "@liquity/lib-ethers";
import { SubgraphLiquity } from "@liquity/lib-subgraph";

import {
  checkPoolBalances,
  checkSubgraph,
  checkTroveOrdering,
  connectUsers,
  createRandomWallets,
  dumpTroves,
  getListOfTrovesBeforeRedistribution,
  shortenAddress
} from "./utils";

import { Fixture } from "./Fixture";

dotenv.config();

const provider = new JsonRpcProvider("http://localhost:8545");
const subgraph = new SubgraphLiquity("http://localhost:8000/subgraphs/name/liquity/subgraph");

const deployer = process.env.DEPLOYER_PRIVATE_KEY
  ? new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider)
  : Wallet.createRandom().connect(provider);

const funder = new Wallet(
  "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7",
  provider
);

yargs
  .scriptName("yarn fuzzer")

  .command(
    "warzone",
    "Create lots of Troves.",
    {
      troves: {
        alias: "n",
        default: 1000,
        description: "Number of troves to create"
      }
    },
    async ({ troves }) => {
      const deployerLiquity = await Liquity.connect(deployer);

      const price = await deployerLiquity.getPrice();

      for (let i = 1; i <= troves; ++i) {
        const user = Wallet.createRandom().connect(provider);
        const userAddress = await user.getAddress();
        const debt = LUSD_LIQUIDATION_RESERVE.add(99999 * Math.random());
        const collateral = debt.mul(price).mul(1.11 + 3 * Math.random());

        const liquity = await Liquity.connect(user);

        await funder.sendTransaction({
          to: userAddress,
          value: Decimal.from(collateral).hex
        });

        const fees = await liquity.getFees();
        await liquity.openTrove(Trove.recreate(new Trove(collateral, debt), fees.borrowingRate()), {
          gasPrice: 0
        });

        if (i % 4 === 0) {
          const lusdBalance = await liquity.getLUSDBalance();
          await liquity.depositLUSDInStabilityPool(lusdBalance);
        }

        if (i % 10 === 0) {
          console.log(`Created ${i} Troves.`);
        }

        //await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }
  )

  .command(
    "chaos",
    "Try to break Liquity by randomly interacting with it.",
    {
      users: {
        alias: "u",
        default: 40,
        description: "Number of users to spawn"
      },
      rounds: {
        alias: "n",
        default: 25,
        description: "How many times each user should interact with Liquity"
      },
      subgraph: {
        alias: "g",
        default: false,
        description: "Check after every round that subgraph data matches layer 1"
      }
    },
    async ({ rounds: numberOfRounds, users: numberOfUsers, subgraph: shouldCheckSubgraph }) => {
      const [frontend, ...randomUsers] = createRandomWallets(numberOfUsers + 1, provider);

      const [
        deployerLiquity,
        funderLiquity,
        frontendLiquity,
        ...randomLiquities
      ] = await connectUsers([deployer, funder, frontend, ...randomUsers]);

      const fixture = await Fixture.setup(
        deployerLiquity,
        funder,
        funderLiquity,
        frontend.address,
        frontendLiquity
      );

      let previousListOfTroves: [string, TroveWithPendingRedistribution][] | undefined = undefined;

      console.log();
      console.log("// Keys");
      console.log(`[frontend]: ${frontend.privateKey}`);
      randomUsers.forEach(user =>
        console.log(`[${shortenAddress(user.address)}]: ${user.privateKey}`)
      );

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
    }
  )

  .command(
    "order",
    "End chaos and restore order by liquidating every Trove except the Funder's.",
    {},
    async () => {
      const [deployerLiquity, funderLiquity] = await connectUsers([deployer, funder]);

      const initialPrice = await deployerLiquity.getPrice();
      let initialNumberOfTroves = await funderLiquity.getNumberOfTroves();

      let [[firstTroveOwner]] = await funderLiquity.getTroves({
        first: 1,
        sortedBy: "descendingCollateralRatio"
      });

      if (firstTroveOwner !== funder.address) {
        let trove = await funderLiquity.getTrove();

        if (trove.isEmpty) {
          await funderLiquity.openTrove({ depositCollateral: 1000 });
          trove = await funderLiquity.getTrove();
        }

        const lusdBalance = await funderLiquity.getLUSDBalance();

        if (lusdBalance.lt(trove.netDebt)) {
          const [randomUser] = createRandomWallets(1, provider);
          const randomLiquity = await Liquity.connect(randomUser);

          const lusdNeeded = trove.netDebt.sub(lusdBalance);
          const tempTrove = {
            depositCollateral: LUSD_LIQUIDATION_RESERVE.add(lusdNeeded).div(initialPrice).mul(3),
            borrowLUSD: lusdNeeded
          };

          await funder.sendTransaction({
            to: randomUser.address,
            value: tempTrove.depositCollateral.hex
          });

          await randomLiquity.openTrove(tempTrove, { gasPrice: 0 });
          initialNumberOfTroves++;
          await randomLiquity.sendLUSD(funder.address, lusdNeeded, { gasPrice: 0 });
        }

        await funderLiquity.repayLUSD(trove.netDebt);
      }

      [[firstTroveOwner]] = await funderLiquity.getTroves({
        first: 1,
        sortedBy: "descendingCollateralRatio"
      });

      if (firstTroveOwner !== funder.address) {
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
    }
  )

  .command("check-sorting", "Check if Troves are sorted by ICR.", {}, async () => {
    const deployerLiquity = await Liquity.connect(deployer);
    const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerLiquity);
    const totalRedistributed = await deployerLiquity.getTotalRedistributed();
    const price = await deployerLiquity.getPrice();

    checkTroveOrdering(listOfTroves, totalRedistributed, price);

    console.log("All Troves are sorted.");
  })

  .command("check-subgraph", "Check that subgraph data matches layer 1.", {}, async () => {
    const deployerLiquity = await Liquity.connect(deployer);

    await checkSubgraph(subgraph, deployerLiquity);

    console.log("Subgraph looks fine.");
  })

  .command("dump-troves", "Dump list of Troves.", {}, async () => {
    const deployerLiquity = await Liquity.connect(deployer);
    const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerLiquity);
    const totalRedistributed = await deployerLiquity.getTotalRedistributed();
    const price = await deployerLiquity.getPrice();

    dumpTroves(listOfTroves, totalRedistributed, price);
  })

  .demandCommand()
  .wrap(null)
  .parse();
