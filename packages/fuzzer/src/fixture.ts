import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@liquity/decimal";
import { Trove } from "@liquity/lib-base";
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

  async setRandomPrice() {
    this.price = this.price.add(100 * Math.random() + 150).div(2);
    console.log(`[deployer] setPrice(${this.price})`);
    await this.deployerLiquity.setPrice(this.price);

    return this.price;
  }

  async liquidateTroves(maximumNumberOfTrovesToLiquidate: number) {
    const trovesBefore = await getListOfTroveOwners(this.deployerLiquity);

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
  }

  async openRandomTrove(liquity: Liquity) {
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
      to: liquity.userAddress,
      value: newTrove.collateral.bigNumber
    });

    console.log(
      `[${shortenAddress(liquity.userAddress!)}] openTrove({ ` +
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

  async closeTrove(liquity: Liquity, trove: Trove) {
    let total = await liquity.getTotal();

    while (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      await this.funderLiquity.depositEther(benford(50000), {
        price: this.price,
        numberOfTroves: this.numberOfTroves
      });

      total = await liquity.getTotal();
    }

    await this.funderLiquity.sendQui(liquity.userAddress!, trove.debt);

    console.log(`[${shortenAddress(liquity.userAddress!)}] closeTrove()`);
    await liquity.closeTrove({ gasPrice: 0 });

    this.numberOfTroves--;
  }

  async redeemRandomAmount(liquity: Liquity) {
    const exchangedQui = benford(5000);

    await this.funderLiquity.sendQui(liquity.userAddress!, exchangedQui);

    console.log(`[${shortenAddress(liquity.userAddress!)}] redeemCollateral(${exchangedQui})`);
    await liquity.redeemCollateral(
      exchangedQui,
      { price: this.price, numberOfTroves: this.numberOfTroves },
      { gasPrice: 0 }
    );
  }
}
