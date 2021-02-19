import assert from "assert";

import { BigNumber } from "@ethersproject/bignumber";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal, Decimalish, Trove } from "@liquity/lib-base";
import { EthersLiquity as Liquity, EthersTransactionFailedError } from "@liquity/lib-ethers";

import {
  createRandomTrove,
  shortenAddress,
  benford,
  getListOfTroveOwners,
  listDifference,
  getListOfTroves
} from "./utils";

const objToString = (o: Record<string, unknown>) =>
  "{ " +
  Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ") +
  " }";

export class Fixture {
  private readonly deployerLiquity: Liquity;
  private readonly funderLiquity: Liquity;
  private readonly funder: Signer;

  private readonly depositGasUsedBins = new Array<number>(100).fill(0);
  private depositTxFailures = 0;

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
      await funderLiquity.openTrove({ depositCollateral: 1000, borrowLUSD: 132000 });
    }

    return new Fixture(deployerLiquity, funderLiquity, funder, price);
  }

  private async sendLUSDFromFunder(toAddress: string, amount: Decimalish) {
    amount = Decimal.from(amount);

    const lusdBalance = await this.funderLiquity.getLUSDBalance();

    if (lusdBalance.lt(amount)) {
      const trove = await this.funderLiquity.getTrove();

      let newTrove = trove.adjust({ borrowLUSD: amount.sub(lusdBalance).mul(2) });
      newTrove = trove.setCollateral(newTrove.debt.mulDiv(1.51, this.price));

      const params = trove.adjustTo(newTrove);
      console.log(`[deployer] adjustTrove(${objToString(params)})`);
      await this.funderLiquity.adjustTrove(trove.adjustTo(newTrove));
    }

    await this.funderLiquity.sendLUSD(toAddress, amount);
  }

  async setRandomPrice() {
    this.price = this.price.add(200 * Math.random() + 100).div(2);
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

    const cannotOpen = (newTrove: Trove) =>
      total.collateralRatioIsBelowCritical(this.price)
        ? newTrove.collateralRatioIsBelowCritical(this.price)
        : newTrove.collateralRatioIsBelowMinimum(this.price) ||
          total.add(newTrove).collateralRatioIsBelowCritical(this.price);

    do {
      newTrove = createRandomTrove(this.price);
    } while (cannotOpen(newTrove));

    await this.funder.sendTransaction({
      to: userAddress,
      value: newTrove.collateral.hex
    });

    const params = Trove.recreate(newTrove, fees.borrowingRate());
    console.log(`[${shortenAddress(userAddress)}] openTrove(${objToString(params)})`);
    await liquity.openTrove(params, { gasPrice: 0 });
  }

  async closeTrove(userAddress: string, liquity: Liquity, trove: Trove) {
    const total = await liquity.getTotal();

    if (total.collateralRatioIsBelowCritical(this.price)) {
      // Cannot close Trove during recovery mode
      console.log("// Skipping closeTrove() in recovery mode");
      return;
    }

    await this.sendLUSDFromFunder(userAddress, trove.debt);

    console.log(`[${shortenAddress(userAddress)}] closeTrove()`);
    await liquity.closeTrove({ gasPrice: 0 });
  }

  async redeemRandomAmount(userAddress: string, liquity: Liquity) {
    const amount = benford(10000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] redeemLUSD(${amount})`);
    await liquity.redeemLUSD(amount, { gasPrice: 0 });
  }

  async depositRandomAmountInStabilityPool(userAddress: string, liquity: Liquity) {
    const amount = benford(20000);

    await this.sendLUSDFromFunder(userAddress, amount);

    console.log(`[${shortenAddress(userAddress)}] depositLUSDInStabilityPool(${amount})`);

    const tx = await liquity.send.depositLUSDInStabilityPool(amount, undefined, { gasPrice: 0 });
    const receipt = await tx.waitForReceipt();

    if (receipt.status === "succeeded") {
      this.addToDepositGasUsedHisto(receipt.rawReceipt.gasUsed);
      console.log(`// gasUsed = ${receipt.rawReceipt.gasUsed}`);
    } else {
      this.depositTxFailures++;

      console.log(
        `// !!! Failed with gasLimit = ${tx.rawSentTransaction.gasLimit}, ` +
          `gasUsed = ${receipt.rawReceipt.gasUsed}`
      );

      const tx2 = await liquity.send.depositLUSDInStabilityPool(amount, undefined, { gasPrice: 0 });
      const receipt2 = await tx2.waitForReceipt();

      if (receipt2.status === "succeeded") {
        this.addToDepositGasUsedHisto(receipt2.rawReceipt.gasUsed);
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

  private addToDepositGasUsedHisto(gasUsed: BigNumber) {
    const binIndex = Math.floor(gasUsed.toNumber() / 10000);
    assert(binIndex < this.depositGasUsedBins.length);
    this.depositGasUsedBins[binIndex]++;
  }

  summarizeDepositStats() {
    console.log(`Number of deposit TX failures: ${this.depositTxFailures}`);

    const firstNonZeroIndex = this.depositGasUsedBins.findIndex(x => x > 0);
    const lastNonZeroIndex =
      this.depositGasUsedBins.length -
      1 -
      this.depositGasUsedBins
        .slice()
        .reverse()
        .findIndex(x => x > 0);

    console.log("Desposit TX gas usage histogram:");
    for (let i = firstNonZeroIndex; i <= lastNonZeroIndex; ++i) {
      console.log(`  ${i}?K: ${this.depositGasUsedBins[i]}`);
    }
  }
}
