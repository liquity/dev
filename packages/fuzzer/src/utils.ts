import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Wallet } from "@ethersproject/wallet";

import {
  Decimal,
  Decimalish,
  Difference,
  Percent,
  Trove,
  TroveWithPendingRedistribution,
  ReadableLiquity
} from "@liquity/lib-base";
import { EthersLiquity as Liquity, LiquityDeployment } from "@liquity/lib-ethers";
import { SubgraphLiquity } from "@liquity/lib-subgraph";

export const createRandomWallets = (numberOfWallets: number, provider: Provider) => {
  const accounts = new Array<Wallet>(numberOfWallets);

  for (let i = 0; i < numberOfWallets; ++i) {
    accounts[i] = Wallet.createRandom().connect(provider);
  }

  return accounts;
};

export const createRandomTrove = (price: Decimal) => {
  let collateral: Decimal, debt: Decimal;
  let randomValue = truncateLastDigits(benford(1000));

  if (Math.random() < 0.5) {
    collateral = Decimal.from(randomValue);

    const maxDebt = parseInt(price.mul(collateral).div(1.1).toString(0));

    debt = Decimal.from(truncateLastDigits(maxDebt - benford(maxDebt)));
  } else {
    debt = Decimal.from(100 * randomValue);
    collateral = Decimal.from(
      debt
        .div(price)
        .mul(10 + benford(20))
        .div(10)
        .toString(1)
    );
  }

  return new Trove({ collateral, debt });
};

export const getListOfTroves = async (liquity: ReadableLiquity) =>
  liquity.getFirstTroves(0, await liquity.getNumberOfTroves());

export const getListOfTroveOwners = async (liquity: ReadableLiquity) =>
  getListOfTroves(liquity).then(troves => troves.map(([owner]) => owner));

const tinyDifference = Decimal.from("0.000000001");

const sortedByICR = async (
  liquity: ReadableLiquity,
  listOfTroves: [string, TroveWithPendingRedistribution][],
  price: Decimalish
) => {
  if (listOfTroves.length < 2) {
    return true;
  }

  const totalRedistributed = await liquity.getTotalRedistributed();
  let currentTrove = listOfTroves[0][1].applyRedistribution(totalRedistributed);

  for (let i = 1; i < listOfTroves.length; ++i) {
    const nextTrove = listOfTroves[i][1].applyRedistribution(totalRedistributed);

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
  listA: [string, TroveWithPendingRedistribution][],
  listB: [string, TroveWithPendingRedistribution][]
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

export const checkTroveOrdering = async (
  liquity: ReadableLiquity,
  price: Decimal,
  listOfTroves: [string, TroveWithPendingRedistribution][],
  previousListOfTroves?: [string, TroveWithPendingRedistribution][]
) => {
  if (!(await sortedByICR(liquity, listOfTroves, price))) {
    if (previousListOfTroves) {
      console.log();
      console.log("// List of Troves before:");
      await dumpTroves(liquity, previousListOfTroves, price);
      console.log();
      console.log("// List of Troves after:");
    }

    await dumpTroves(liquity, listOfTroves, price);
    throw new Error("ordering is broken");
  }
};

const numbersEqual = (a: number, b: number) => a === b;
const decimalsEqual = (a: Decimal, b: Decimal) => a.eq(b);
const trovesEqual = (a: Trove, b: Trove) => a.equals(b);

const trovesRoughlyEqual = (troveA: Trove, troveB: Trove) =>
  [
    [troveA.collateral, troveB.collateral],
    [troveA.debt, troveB.debt]
  ].every(([a, b]) => Difference.between(a, b).absoluteValue?.lt(tinyDifference));

class EqualityCheck<T> {
  private name: string;
  private get: (l: ReadableLiquity) => Promise<T>;
  private equals: (a: T, b: T) => boolean;

  constructor(
    name: string,
    get: (l: ReadableLiquity) => Promise<T>,
    equals: (a: T, b: T) => boolean
  ) {
    this.name = name;
    this.get = get;
    this.equals = equals;
  }

  async allEqual(liquities: ReadableLiquity[]) {
    const [a, ...rest] = await Promise.all(liquities.map(l => this.get(l)));

    if (!rest.every(b => this.equals(a, b))) {
      throw new Error(`Mismatch in ${this.name}`);
    }
  }
}

const checks = [
  new EqualityCheck("numberOfTroves", l => l.getNumberOfTroves(), numbersEqual),
  new EqualityCheck("price", l => l.getPrice(), decimalsEqual),
  new EqualityCheck("total", l => l.getTotal(), trovesRoughlyEqual),
  new EqualityCheck("totalRedistributed", l => l.getTotalRedistributed(), trovesEqual),
  new EqualityCheck("tokensInStabilityPool", l => l.getLUSDInStabilityPool(), decimalsEqual)
];

export const checkSubgraph = async (subgraph: SubgraphLiquity, l1Liquity: ReadableLiquity) => {
  await Promise.all(checks.map(check => check.allEqual([subgraph, l1Liquity])));

  const l1ListOfTroves = await getListOfTroves(l1Liquity);
  const subgraphListOfTroves = await getListOfTroves(subgraph);
  listOfTrovesShouldBeEqual(l1ListOfTroves, subgraphListOfTroves);

  const price = await l1Liquity.getPrice();
  if (!(await sortedByICR(subgraph, subgraphListOfTroves, price))) {
    console.log();
    console.log("// List of Troves returned by subgraph:");
    await dumpTroves(subgraph, subgraphListOfTroves, price);
    throw new Error("subgraph sorting broken");
  }
};

export const shortenAddress = (address: string) => address.substr(0, 6) + "..." + address.substr(-4);

const troveToString = (
  address: string,
  troveWithPendingRewards: TroveWithPendingRedistribution,
  totalRedistributed: Trove,
  price: Decimalish
) => {
  const trove = troveWithPendingRewards.applyRedistribution(totalRedistributed);
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
  listOfTroves: [string, TroveWithPendingRedistribution][],
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
        .applyRedistribution(totalRedistributed)
        .collateralRatio(price)
        .sub(tinyDifference)
        .gt(currentTrove.applyRedistribution(totalRedistributed).collateralRatio(price))
    ) {
      console.log(`!! ${troveToString(nextOwner, nextTrove, totalRedistributed, price)}`.red);
    } else {
      console.log(`   ${troveToString(nextOwner, nextTrove, totalRedistributed, price)}`);
    }

    [currentOwner, currentTrove] = [nextOwner, nextTrove];
  }
};

export const benford = (max: number) => Math.floor(Math.exp(Math.log(max) * Math.random()));

const truncateLastDigits = (n: number) => {
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

export const connectUsers = (users: Signer[], deployment: LiquityDeployment) =>
  Promise.all(users.map(user => Liquity.connect(deployment, user)));
