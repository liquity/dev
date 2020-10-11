import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Decimalish, Percent } from "@liquity/decimal";
import { Trove, TroveWithPendingRewards, ReadableLiquity } from "@liquity/lib-base";
import { EthersLiquity as Liquity, LiquityContractAddresses } from "@liquity/lib-ethers";
import { SubgraphLiquity } from "@liquity/lib-subgraph";

export const createRandomWallets = (numberOfWallets: number, provider: Provider) => {
  const accounts = new Array<Wallet>(numberOfWallets);

  for (let i = 0; i < numberOfWallets; ++i) {
    accounts[i] = Wallet.createRandom().connect(provider);
  }

  return accounts;
};

export const getListOfTroves = async (liquity: ReadableLiquity) =>
  liquity.getFirstTroves(0, await liquity.getNumberOfTroves());

export const getListOfTroveOwners = async (liquity: ReadableLiquity) =>
  getListOfTroves(liquity).then(troves => troves.map(([owner]) => owner));

export const tinyDifference = Decimal.from("0.000000001");

export const sortedByICR = async (
  liquity: ReadableLiquity,
  listOfTroves: (readonly [string, TroveWithPendingRewards])[],
  price: Decimalish
) => {
  if (listOfTroves.length < 2) {
    return true;
  }

  const totalRedistributed = await liquity.getTotalRedistributed();
  let currentTrove = listOfTroves[0][1].applyRewards(totalRedistributed);

  for (let i = 1; i < listOfTroves.length; ++i) {
    const nextTrove = listOfTroves[i][1].applyRewards(totalRedistributed);

    if (
      nextTrove.collateralRatio(price).gt(currentTrove.collateralRatio(price).add(tinyDifference))
    ) {
      return false;
    }

    currentTrove = nextTrove;
  }

  return true;
};

export const listDifference = (listA: string[], listB: string[]) => {
  const setB = new Set(listB);
  return listA.filter(x => !setB.has(x));
};

export const listOfTrovesShouldBeEqual = (
  listA: (readonly [string, TroveWithPendingRewards])[],
  listB: (readonly [string, TroveWithPendingRewards])[]
) => {
  if (listA.length !== listB.length) {
    throw new Error("length of trove lists is different");
  }

  const mapB = new Map(listB);

  listA.forEach(([owner, troveA]) => {
    const troveB = mapB.get(owner);

    if (!troveB) {
      throw new Error(`${owner} has no trove in listB`);
    }

    if (!troveA.equals(troveB)) {
      throw new Error(`${owner} has different troves in listA & listB`);
    }
  });
};

export const checkSubgraph = async (subgraph: SubgraphLiquity, l1Liquity: ReadableLiquity) => {
  const l1NumberOfTroves = await l1Liquity.getNumberOfTroves();
  const subgraphNumberOfTroves = await subgraph.getNumberOfTroves();

  if (l1NumberOfTroves !== subgraphNumberOfTroves) {
    throw new Error("Mismatch between L1 and subgraph numberOfTroves");
  }

  const l1Price = await l1Liquity.getPrice();
  const subgraphPrice = await subgraph.getPrice();

  if (!l1Price.eq(subgraphPrice)) {
    throw new Error("Mismatch between L1 and subgraph price");
  }

  const l1Total = await l1Liquity.getTotal();
  const subgraphTotal = await subgraph.getTotal();

  if (!l1Total.equals(subgraphTotal)) {
    throw new Error("Mismatch between L1 and subgraph total");
  }

  const l1TotalRedistributed = await l1Liquity.getTotalRedistributed();
  const subgraphTotalRedistributed = await subgraph.getTotalRedistributed();

  if (!l1TotalRedistributed.equals(subgraphTotalRedistributed)) {
    throw new Error("Mismatch between L1 and subgraph totalRedistributed");
  }

  const l1TokensInStabilityPool = await l1Liquity.getQuiInStabilityPool();
  const subgraphTokensInStabilityPool = await subgraph.getQuiInStabilityPool();

  if (!l1TokensInStabilityPool.eq(subgraphTokensInStabilityPool)) {
    throw new Error("Mismatch between L1 and subgraph tokensInStabilityPool");
  }

  const l1ListOfTroves = await getListOfTroves(l1Liquity);
  const subgraphListOfTroves = await getListOfTroves(subgraph);
  listOfTrovesShouldBeEqual(l1ListOfTroves, subgraphListOfTroves);

  if (!(await sortedByICR(subgraph, subgraphListOfTroves, l1Price))) {
    console.log();
    console.log("// List of Troves returned by subgraph:");
    await dumpTroves(subgraph, subgraphListOfTroves, l1Price);
    throw new Error("subgraph sorting broken");
  }
};

export const shortenAddress = (address: string) => address.substr(0, 6) + "..." + address.substr(-4);

export const troveToString = (
  address: string,
  troveWithPendingRewards: TroveWithPendingRewards,
  totalRedistributed: Trove,
  price: Decimalish
) => {
  const trove = troveWithPendingRewards.applyRewards(totalRedistributed);
  const rewards = trove.subtract(troveWithPendingRewards);

  return (
    `[${shortenAddress(address)}]: ` +
    `ICR = ${new Percent(trove.collateralRatio(price)).toString(2)}, ` +
    `ICR w/o reward = ${new Percent(troveWithPendingRewards.collateralRatio(price)).toString(2)}, ` +
    `stake = ${troveWithPendingRewards.stake.toString(2)}, ` +
    `coll = ${trove.collateral.toString(2)}, ` +
    `debt = ${trove.debt.toString(2)}, ` +
    `coll reward = ${rewards.collateral.toString(2)}, ` +
    `debt reward = ${rewards.debt.toString(2)}`
  );
};

export const dumpTroves = async (
  liquity: ReadableLiquity,
  listOfTroves: (readonly [string, TroveWithPendingRewards])[],
  price: Decimalish
) => {
  if (listOfTroves.length === 0) {
    return;
  }

  const totalRedistributed = await liquity.getTotalRedistributed();
  let [currentOwner, currentTrove] = listOfTroves[0];
  console.log(`   ${troveToString(currentOwner, currentTrove, totalRedistributed, price)}`);

  for (let i = 1; i < listOfTroves.length; ++i) {
    const [nextOwner, nextTrove] = listOfTroves[i];

    if (
      nextTrove
        .applyRewards(totalRedistributed)
        .collateralRatio(price)
        .gt(currentTrove.applyRewards(totalRedistributed).collateralRatio(price))
    ) {
      console.log(`!! ${troveToString(nextOwner, nextTrove, totalRedistributed, price)}`.red);
    } else {
      console.log(`   ${troveToString(nextOwner, nextTrove, totalRedistributed, price)}`);
    }

    [currentOwner, currentTrove] = [nextOwner, nextTrove];
  }
};

export const benford = (max: number) => Math.floor(Math.exp(Math.log(max) * Math.random()));

export const truncateLastDigits = (n: number) => {
  if (n > 100000) {
    return 1000 * Math.floor(n / 1000);
  } else if (n > 10000) {
    return 100 * Math.floor(n / 100);
  } else if (n > 1000) {
    return 10 * Math.floor(n / 10);
  } else {
    return n;
  }
};

export const connectUsers = (users: Signer[], addresses: LiquityContractAddresses) =>
  Promise.all(users.map(user => Liquity.connect(addresses, user)));
