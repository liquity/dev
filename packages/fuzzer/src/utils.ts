import { Signer } from "@ethersproject/abstract-signer";
import { Provider } from "@ethersproject/abstract-provider";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Decimalish, Percent } from "@liquity/decimal";
import { Trove, TroveWithPendingRewards } from "@liquity/lib-base";
import { EthersLiquity as Liquity, LiquityContractAddresses } from "@liquity/lib-ethers";

export const createRandomWallets = (numberOfWallets: number, provider: Provider) => {
  const accounts = new Array<Wallet>(numberOfWallets);

  for (let i = 0; i < numberOfWallets; ++i) {
    accounts[i] = Wallet.createRandom().connect(provider);
  }

  return accounts;
};

export const getListOfTroves = async (liquity: Liquity) =>
  liquity.getFirstTroves(0, await liquity.getNumberOfTroves());

export const getListOfTroveOwners = async (liquity: Liquity) =>
  getListOfTroves(liquity).then(troves => troves.map(([owner]) => owner));

export const tinyDifference = Decimal.from("0.000000001");

export const sortedByICR = async (
  liquity: Liquity,
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
  liquity: Liquity,
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
