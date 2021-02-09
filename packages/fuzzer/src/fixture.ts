import { Signer } from "@ethersproject/abstract-signer";

import { Decimal, Decimalish, Trove } from "@liquity/lib-base";
import { EthersLiquity as Liquity } from "@liquity/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference
} from "./utils";

export class Fixture {
  private readonly deployerLiquity: Liquity;
  private readonly funderLiquity: Liquity;
  private readonly funder: Signer;

  private price: Decimal;
  private numberOfTroves: number;

  totalNumberOfLiquidations = 0;

  private constructor(
    deployerLiquity: Liquity,
    funderLiquity: Liquity,
    funder: Signer,
    price: Decimal,
    numberOfTroves: number
  ) {
    this.deployerLiquity = deployerLiquity;
    this.funderLiquity = funderLiquity;
    this.funder = funder;
    this.price = price;
    this.numberOfTroves = numberOfTroves;
  }

  static async setup(deployerLiquity: Liquity, funderLiquity: Liquity, funder: Signer) {
    const price = await deployerLiquity.getPrice();
    let numberOfTroves = await deployerLiquity.getNumberOfTroves();
    const funderTrove = await funderLiquity.getTrove();

    if (funderTrove.isEmpty) {
      await funderLiquity.openTrove(new Trove({ collateral: 10000, debt: 1000000 }), {
        price,
        numberOfTroves
      });

      numberOfTroves++;
    }

    return new Fixture(deployerLiquity, funderLiquity, funder, price, numberOfTroves);
  }

  private async sendLUSDFromFunder(toAddress: string, amount: Decimalish) {
    while ((await this.funderLiquity.getLUSDBalance()).lt(amount)) {
      await this.funderLiquity.adjustTrove(
        { depositCollateral: 10000, borrowLUSD: 1000000 },
        { price: this.price, numberOfTroves: this.numberOfTroves }
      );
    }

    await this.funderLiquity.sendLUSD(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(100 * Math.random() + 150).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerLiquity.setPrice(this.price);

    return this.price;
  }

  async liquidateRandomNumberOfTroves() {
    const lusdInStabilityPoolBefore = await this.deployerLiquity.getLUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${lusdInStabilityPoolBefore}`);

    const trovesBefore = await getListOfTroveOwners(this.deployerLiquity);

    const maximumNumberOfTrovesToLiquidate = Math.floor(50 * Math.random()) + 1;
    console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
    await this.deployerLiquity.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

    const trovesAfter = await getListOfTroveOwners(this.deployerLiquity);
    const liquidatedTroves = listDifference(trovesBefore, trovesAfter);

    if (liquidatedTroves.length > 0) {
      for (const liquidatedTrove of liquidatedTroves) {
        console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
      }
    }

    this.numberOfTroves -= liquidatedTroves.length;
    this.totalNumberOfLiquidations += liquidatedTroves.length;

    const lusdInStabilityPoolAfter = await this.deployerLiquity.getLUSDInStabilityPool();
    console.log(`// Stability Pool balance: ${lusdInStabilityPoolAfter}`);
  }

  async openRandomTrove(userAddress: string, liquity: Liquity) {
    let newTrove: Trove;
    let total = await liquity.getTotal();

    do {
      newTrove = createRandomTrove(this.price);
    } while (newTrove.collateralRatioIsBelowMinimum(this.price));

    while (total.add(newTrove).collateralRatioIsBelowCritical(this.price)) {
      // Would fail to open the Trove due to TCR
      newTrove = new Trove({
        collateral: newTrove.collateral.mul(2),
        debt: 0
      });
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

    await liquity.openTrove(
      newTrove,
      { price: this.price, numberOfTroves: this.numberOfTroves },
      { gasPrice: 0 }
    );

    this.numberOfTroves++;
  }

  async closeTrove(userAddress: string, liquity: Liquity, trove: Trove) {
    let total = await liquity.getTotal();

    while (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      await this.funderLiquity.depositCollateral(benford(50000), {
        price: this.price,
        numberOfTroves: this.numberOfTroves
      });

      total = await liquity.getTotal();
    }

    await this.sendLUSDFromFunder(userAddress, trove.debt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);
    await liquity.closeTrove({ gasPrice: 0 });

    this.numberOfTroves--;
  }

  async redeemRandomAmount(userAddress: string, liquity: Liquity) {
    const amount = benford(100000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemLUSD(${amount})`);
    await liquity.redeemLUSD(
      amount,
      { price: this.price, numberOfTroves: this.numberOfTroves },
      { gasPrice: 0 }
    );
  }

  async depositRandomAmountInStabilityPool(userAddress: string, liquity: Liquity) {
    const amount = benford(10000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositLUSDInStabilityPool(${amount})`);

    await liquity.depositLUSDInStabilityPool(amount, undefined, { gasPrice: 0 });
  }

  async sweepLUSD(liquity: Liquity) {
    const lusdBalance = await liquity.getLUSDBalance();
    await liquity.sendLUSD(await this.funder.getAddress(), lusdBalance, { gasPrice: 0 });
  }
}
