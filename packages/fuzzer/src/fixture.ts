import { Signer } from "@ethersproject/abstract-signer";

import { Decimal, Decimalish, LUSD_LIQUIDATION_RESERVE, Trove } from "@liquity/lib-base";
import { EthersLiquity as Liquity, EthersTransactionFailedError } from "@liquity/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference,
  getListOfTroves
} from "./utils";

export class Fixture {
  private readonly deployerLiquity: Liquity;
  private readonly funderLiquity: Liquity;
  private readonly funder: Signer;

  private price: Decimal;

  totalNumberOfLiquidations = 0;

  private constructor(
    deployerLiquity: Liquity,
    funderLiquity: Liquity,
    funder: Signer,
    price: Decimal
  ) {
    this.deployerLiquity = deployerLiquity;
    this.funderLiquity = funderLiquity;
    this.funder = funder;
    this.price = price;
  }

  static async setup(deployerLiquity: Liquity, funderLiquity: Liquity, funder: Signer) {
    const price = await deployerLiquity.getPrice();
    const funderTrove = await funderLiquity.getTrove();

    if (funderTrove.isEmpty) {
      await funderLiquity.openTrove({ depositCollateral: 10000, borrowLUSD: 1000000 });
    }

    return new Fixture(deployerLiquity, funderLiquity, funder, price);
  }

  private async sendLUSDFromFunder(toAddress: string, amount: Decimalish) {
    while ((await this.funderLiquity.getLUSDBalance()).lt(amount)) {
      await this.funderLiquity.adjustTrove({ depositCollateral: 10000, borrowLUSD: 1000000 });
    }

    await this.funderLiquity.sendLUSD(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(100 * Math.random() + 150).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerLiquity.setPrice(this.price);

    return this.price;
  }

  async liquidateRandomNumberOfTroves(price: Decimal) {
    const lusdInStabilityPoolBefore = await this.deployerLiquity.getLUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${lusdInStabilityPoolBefore}`);

    const trovesBefore = await getListOfTroves(this.deployerLiquity);
    const troveOwnersBefore = trovesBefore.map(([owner]) => owner);
    const [, lastTrove] = trovesBefore[trovesBefore.length - 1];

    if (!lastTrove.collateralRatioIsBelowMinimum(price)) {
      console.log("// No Troves to liquidate");
      return;
    }

    const maximumNumberOfTrovesToLiquidate = Math.floor(50 * Math.random()) + 1;
    console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
    await this.deployerLiquity.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

    const troveOwnersAfter = await getListOfTroveOwners(this.deployerLiquity);
    const liquidatedTroves = listDifference(troveOwnersBefore, troveOwnersAfter);

    if (liquidatedTroves.length > 0) {
      for (const liquidatedTrove of liquidatedTroves) {
        console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
      }
    }

    this.totalNumberOfLiquidations += liquidatedTroves.length;

    const lusdInStabilityPoolAfter = await this.deployerLiquity.getLUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${lusdInStabilityPoolAfter}`);
  }

  async openRandomTrove(userAddress: string, liquity: Liquity) {
    let newTrove: Trove;
    const total = await liquity.getTotal();
    const fees = await liquity.getFees();

    do {
      newTrove = createRandomTrove(this.price);
    } while (newTrove.collateralRatioIsBelowMinimum(this.price));

    while (total.add(newTrove).collateralRatioIsBelowCritical(this.price)) {
      // Would fail to open the Trove due to TCR
      newTrove = new Trove(newTrove.collateral.mul(2), LUSD_LIQUIDATION_RESERVE);
    }

    await this.funder.sendTransaction({
      to: userAddress,
      value: newTrove.collateral.hex
    });

    console.log(
      `[${shortenAddress(userAddress)}] openTrove({ ` +
        `collateral: ${newTrove.collateral}, ` +
        `debt: ${newTrove.debt} })`
    );

    await liquity.openTrove(Trove.recreate(newTrove, fees.borrowingRate()), { gasPrice: 0 });
  }

  async closeTrove(userAddress: string, liquity: Liquity, trove: Trove) {
    let total = await liquity.getTotal();

    while (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      await this.funderLiquity.depositCollateral(benford(50000));

      total = await liquity.getTotal();
    }

    await this.sendLUSDFromFunder(userAddress, trove.debt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);
    await liquity.closeTrove({ gasPrice: 0 });
  }

  async redeemRandomAmount(userAddress: string, liquity: Liquity) {
    const amount = benford(100000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemLUSD(${amount})`);
    await liquity.redeemLUSD(amount, { gasPrice: 0 });
  }

  async depositRandomAmountInStabilityPool(userAddress: string, liquity: Liquity) {
    const amount = benford(10000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositLUSDInStabilityPool(${amount})`);

    const tx = await liquity.send.depositLUSDInStabilityPool(amount, undefined, { gasPrice: 0 });
    const receipt = await tx.waitForReceipt();

    if (receipt.status === "succeeded") {
      console.log(`// gasUsed = ${receipt.rawReceipt.gasUsed}`);
    } else {
      console.log(
        `// !!! Failed with gasLimit = ${tx.rawSentTransaction.gasLimit}, ` +
          `gasUsed = ${receipt.rawReceipt.gasUsed}`
      );

      const tx2 = await liquity.send.depositLUSDInStabilityPool(amount, undefined, { gasPrice: 0 });
      const receipt2 = await tx2.waitForReceipt();

      if (receipt2.status === "succeeded") {
        console.log(
          `// Retry succeeded with gasLimit = ${tx2.rawSentTransaction.gasLimit}, ` +
            `gasUsed = ${receipt2.rawReceipt.gasUsed}`
        );
      } else {
        throw new EthersTransactionFailedError("Transaction failed", receipt2);
      }
    }
  }

  async sweepLUSD(liquity: Liquity) {
    const lusdBalance = await liquity.getLUSDBalance();
    await liquity.sendLUSD(await this.funder.getAddress(), lusdBalance, { gasPrice: 0 });
  }
}
