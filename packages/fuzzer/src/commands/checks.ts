import { EthersStabilio } from "@stabilio/lib-ethers";

import { deployer, subgraph } from "../globals";

import {
  checkSubgraph,
  checkTroveOrdering,
  dumpTroves,
  getListOfTrovesBeforeRedistribution
} from "../utils";

export const checkSorting = async () => {
  const deployerStabilio = await EthersStabilio.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerStabilio);
  const totalRedistributed = await deployerStabilio.getTotalRedistributed();
  const price = await deployerStabilio.getPrice();

  checkTroveOrdering(listOfTroves, totalRedistributed, price);

  console.log("All Troves are sorted.");
};

export const checkSubgraphCmd = async () => {
  const deployerStabilio = await EthersStabilio.connect(deployer);

  await checkSubgraph(subgraph, deployerStabilio);

  console.log("Subgraph looks fine.");
};

export const dumpTrovesCmd = async () => {
  const deployerStabilio = await EthersStabilio.connect(deployer);
  const listOfTroves = await getListOfTrovesBeforeRedistribution(deployerStabilio);
  const totalRedistributed = await deployerStabilio.getTotalRedistributed();
  const price = await deployerStabilio.getPrice();

  dumpTroves(listOfTroves, totalRedistributed, price);
};
