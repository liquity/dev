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

export const setRandomPrice = async (deployerLiquity: Liquity, price: Decimal) => {
  price.add(100 * Math.random() + 150).div(2);
  console.log(`[deployer] setPrice(${price})`);
  await deployerLiquity.setPrice(price);
  return deployerLiquity.getPrice();
};

export const liquidateTroves = async (
  deployerLiquity: Liquity,
  maximumNumberOfTrovesToLiquidate: number
) => {
  const trovesBefore = await getListOfTroveOwners(deployerLiquity);

  console.log(`[deployer] liquidateUpTo(${maximumNumberOfTrovesToLiquidate})`);
  await deployerLiquity.liquidateUpTo(maximumNumberOfTrovesToLiquidate);

  const trovesAfter = await getListOfTroveOwners(deployerLiquity);
  const liquidatedTroves = listDifference(trovesBefore, trovesAfter);

  if (liquidatedTroves.length > 0) {
    for (const liquidatedTrove of liquidatedTroves) {
      console.log(`// Liquidated ${shortenAddress(liquidatedTrove)}`);
    }
  }

  return liquidatedTroves.length;
};

export const openRandomTrove = async (
  liquity: Liquity,
  funder: Signer,
  price: Decimal,
  numberOfTroves: number
) => {
  let newTrove: Trove;
  let total = await liquity.getTotal();

  do {
    newTrove = createRandomTrove(price);
  } while (newTrove.collateralRatioIsBelowMinimum(price));

  while (total.add(newTrove).collateralRatioIsBelowCritical(price)) {
    // Would fail to open the Trove due to TCR
    newTrove = new Trove({
      collateral: newTrove.collateral.mul(2),
      debt: 0
    });
  }

  await funder.sendTransaction({
    to: liquity.userAddress,
    value: newTrove.collateral.bigNumber
  });

  console.log(
    `[${shortenAddress(liquity.userAddress!)}] openTrove({ ` +
      `collateral: ${newTrove.collateral}, ` +
      `debt: ${newTrove.debt} })`
  );

  await liquity.openTrove(newTrove, { price, numberOfTroves }, { gasPrice: 0 });
};

export const closeTrove = async (
  liquity: Liquity,
  trove: Trove,
  funderLiquity: Liquity,
  price: Decimal,
  numberOfTroves: number
) => {
  let total = await liquity.getTotal();

  while (total.collateralRatioIsBelowCritical(price)) {
    // Cannot close Trove during recovery mode
    await funderLiquity.depositEther(benford(50000), { price, numberOfTroves });

    total = await liquity.getTotal();
  }

  await funderLiquity.sendQui(liquity.userAddress!, trove.debt);

  console.log(`[${shortenAddress(liquity.userAddress!)}] closeTrove()`);
  await liquity.closeTrove({ gasPrice: 0 });
};

export const redeemRandomAmount = async (
  liquity: Liquity,
  funderLiquity: Liquity,
  price: Decimal,
  numberOfTroves: number
) => {
  const exchangedQui = benford(5000);

  await funderLiquity.sendQui(liquity.userAddress!, exchangedQui);

  console.log(`[${shortenAddress(liquity.userAddress!)}] redeemCollateral(${exchangedQui})`);
  await liquity.redeemCollateral(exchangedQui, { price, numberOfTroves }, { gasPrice: 0 });
};
