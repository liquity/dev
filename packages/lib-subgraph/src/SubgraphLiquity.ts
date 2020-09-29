import fetch from "cross-fetch";
import { gql, ApolloClient, InMemoryCache, NormalizedCacheObject, HttpLink } from "@apollo/client";
import { getAddress } from "@ethersproject/address";
import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";

import { Query } from "./Query";

import {
  ReadableLiquity,
  TroveWithPendingRewards,
  Trove,
  StabilityDeposit
} from "@liquity/lib-base";

import { OrderDirection } from "../types/globalTypes";
import { NumberOfOpenTroves } from "../types/NumberOfOpenTroves";
import { TotalRedistributed } from "../types/TotalRedistributed";
import { TroveRawFields } from "../types/TroveRawFields";
import { TroveWithoutRewards, TroveWithoutRewardsVariables } from "../types/TroveWithoutRewards";
import { Troves, TrovesVariables } from "../types/Troves";
import { Price } from "../types/Price";
import { Total } from "../types/Total";
import { TokensInStabilityPool } from "../types/TokensInStabilityPool";

const normalizeAddress = (address?: string) => {
  if (address === undefined) {
    throw new Error("An address is required");
  }

  return address.toLowerCase();
};

const decimalify = (bigNumberString: string) => new Decimal(BigNumber.from(bigNumberString));

const numberOfTroves = new Query<number, NumberOfOpenTroves>(
  gql`
    query NumberOfOpenTroves {
      global(id: "only") {
        numberOfOpenTroves
      }
    }
  `,
  ({ data: { global } }) => global?.numberOfOpenTroves ?? 0
);

const totalRedistributed = new Query<Trove, TotalRedistributed>(
  gql`
    query TotalRedistributed {
      global(id: "only") {
        rawTotalRedistributedCollateral
        rawTotalRedistributedDebt
      }
    }
  `,
  ({ data: { global } }) => {
    if (global) {
      const { rawTotalRedistributedCollateral, rawTotalRedistributedDebt } = global;

      return new Trove({
        collateral: decimalify(rawTotalRedistributedCollateral),
        debt: decimalify(rawTotalRedistributedDebt),
        virtualDebt: 0
      });
    } else {
      return new Trove({ virtualDebt: 0 });
    }
  }
);

const troveRawFields = gql`
  fragment TroveRawFields on Trove {
    rawCollateral
    rawDebt
    rawStake
    rawSnapshotOfTotalRedistributedCollateral
    rawSnapshotOfTotalRedistributedDebt
  }
`;

const troveFromRawFields = ({
  rawCollateral,
  rawDebt,
  rawStake,
  rawSnapshotOfTotalRedistributedCollateral,
  rawSnapshotOfTotalRedistributedDebt
}: TroveRawFields) =>
  new TroveWithPendingRewards({
    collateral: decimalify(rawCollateral),
    debt: decimalify(rawDebt),
    stake: decimalify(rawStake),

    snapshotOfTotalRedistributed: {
      collateral: decimalify(rawSnapshotOfTotalRedistributedCollateral),
      debt: decimalify(rawSnapshotOfTotalRedistributedDebt)
    }
  });

const troveWithoutRewards = new Query<
  TroveWithPendingRewards,
  TroveWithoutRewards,
  TroveWithoutRewardsVariables
>(
  gql`
    query TroveWithoutRewards($address: ID!) {
      user(id: $address) {
        currentTrove {
          ...TroveRawFields
        }
      }
    }
    ${troveRawFields}
  `,
  ({ data: { user } }) => {
    if (user?.currentTrove) {
      return troveFromRawFields(user.currentTrove);
    } else {
      return new TroveWithPendingRewards();
    }
  }
);

const troves = new Query<(readonly [string, TroveWithPendingRewards])[], Troves, TrovesVariables>(
  gql`
    query Troves($orderDirection: OrderDirection!, $startIdx: Int!, $numberOfTroves: Int!) {
      troves(
        where: { status: open }
        orderBy: collateralRatioSortKey
        orderDirection: $orderDirection
        skip: $startIdx
        first: $numberOfTroves
      ) {
        owner {
          id
        }
        ...TroveRawFields
      }
    }
    ${troveRawFields}
  `,
  ({ data: { troves } }) =>
    troves.map(
      ({ owner: { id }, ...rawFields }) => [getAddress(id), troveFromRawFields(rawFields)] as const
    )
);

const price = new Query<Decimal, Price>(
  gql`
    query Price {
      global(id: "only") {
        currentSystemState {
          price
        }
      }
    }
  `,
  ({ data: { global } }) => Decimal.from(global?.currentSystemState?.price ?? 200)
);

const total = new Query<Trove, Total>(
  gql`
    query Total {
      global(id: "only") {
        currentSystemState {
          totalCollateral
          totalDebt
        }
      }
    }
  `,
  ({ data: { global } }) => {
    if (global?.currentSystemState) {
      const { totalCollateral, totalDebt } = global.currentSystemState;

      return new Trove({
        collateral: totalCollateral,
        debt: totalDebt,
        virtualDebt: 0
      });
    } else {
      return new Trove({ virtualDebt: 0 });
    }
  }
);

const tokensInStabilityPool = new Query<Decimal, TokensInStabilityPool>(
  gql`
    query TokensInStabilityPool {
      global(id: "only") {
        currentSystemState {
          tokensInStabilityPool
        }
      }
    }
  `,
  ({ data: { global } }) => Decimal.from(global?.currentSystemState?.tokensInStabilityPool ?? 0)
);

export class SubgraphLiquity implements ReadableLiquity {
  private client: ApolloClient<NormalizedCacheObject>;

  constructor(uri = "http://localhost:8000/subgraphs/name/liquity/subgraph", pollInterval = 4000) {
    this.client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch, uri }),
      defaultOptions: {
        query: { fetchPolicy: "network-only" },
        watchQuery: { fetchPolicy: "network-only", pollInterval }
      }
    });
  }

  getTotalRedistributed() {
    return totalRedistributed.get(this.client);
  }

  watchTotalRedistributed(onTotalRedistributedChanged: (totalRedistributed: Trove) => void) {
    return totalRedistributed.watch(this.client, onTotalRedistributedChanged);
  }

  getTroveWithoutRewards(address?: string) {
    return troveWithoutRewards.get(this.client, { address: normalizeAddress(address) });
  }

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRewards) => void,
    address?: string
  ) {
    return troveWithoutRewards.watch(this.client, onTroveChanged, {
      address: normalizeAddress(address)
    });
  }

  async getTrove(address?: string) {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveWithoutRewards(address),
      this.getTotalRedistributed()
    ] as const);

    return trove.applyRewards(totalRedistributed);
  }

  getNumberOfTroves(): Promise<number> {
    return numberOfTroves.get(this.client);
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    return numberOfTroves.watch(this.client, onNumberOfTrovesChanged);
  }

  getPrice() {
    return price.get(this.client);
  }

  watchPrice(onPriceChanged: (price: Decimal) => void) {
    return price.watch(this.client, onPriceChanged);
  }

  getTotal() {
    return total.get(this.client);
  }

  watchTotal(onTotalChanged: (total: Trove) => void) {
    return total.watch(this.client, onTotalChanged);
  }

  getStabilityDeposit(address?: string): Promise<StabilityDeposit> {
    throw new Error("Method not implemented.");
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address?: string
  ): () => void {
    throw new Error("Method not implemented.");
  }

  getQuiInStabilityPool() {
    return tokensInStabilityPool.get(this.client);
  }

  watchQuiInStabilityPool(onQuiInStabilityPoolChanged: (quiInStabilityPool: Decimal) => void) {
    return tokensInStabilityPool.watch(this.client, onQuiInStabilityPoolChanged);
  }

  getQuiBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  watchQuiBalance(onQuiBalanceChanged: (balance: Decimal) => void, address?: string): () => void {
    throw new Error("Method not implemented.");
  }

  getFirstTroves(startIdx: number, numberOfTroves: number) {
    return troves.get(this.client, {
      startIdx,
      numberOfTroves,
      orderDirection: OrderDirection.asc
    });
  }

  getLastTroves(startIdx: number, numberOfTroves: number) {
    return troves.get(this.client, {
      startIdx,
      numberOfTroves,
      orderDirection: OrderDirection.desc
    });
  }
}
