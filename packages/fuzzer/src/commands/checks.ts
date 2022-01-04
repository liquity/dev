import { EthersLiquity } from "@liquity/lib-ethers";

import { deployer, subgraph } from "../globals";

import {
  checkSubgraph,
  checkTroveOrdering,
  dumpTroves,
  getListOfTrovesBeforeRedistribution
} from "../utils";

export const checkSorting = async () => {
  const deployerLiquity = await EthersLiquity.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerLiquity);
  const totalRedistributed = await deployerLiquity.getTotalRedistributed();
  const price = await deployerLiquity.getPrice();

  checkTroveOrdering(listOfTroves, totalRedistributed, price);

  console.log("All Troves are sorted.");
};

export const checkSubgraphCmd = async () => {
  const deployerLiquity = await EthersLiquity.connect(deployer);

  await checkSubgraph(subgraph, deployerLiquity);

  console.log("Subgraph looks fine.");
};

export const dumpTrovesCmd = async () => {
  const deployerLiquity = await EthersLiquity.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerLiquity);
  const totalRedistributed = await deployerLiquity.getTotalRedistributed();
  const price = await deployerLiquity.getPrice();

  dumpTroves(listOfTroves, totalRedistributed, price);
};
