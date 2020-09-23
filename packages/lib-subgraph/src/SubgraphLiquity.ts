import fetch from "cross-fetch";
import {
  gql,
  ApolloClient,
  InMemoryCache,
  NormalizedCacheObject,
  HttpLink,
  ApolloQueryResult,
  DocumentNode
} from "@apollo/client";
import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";

import {
  ReadableLiquity,
  TroveWithPendingRewards,
  Trove,
  StabilityDeposit
} from "@liquity/lib-base";

import { TroveStatus } from "../types/globalTypes";
import { TroveWithoutRewards, TroveWithoutRewardsVariables } from "../types/TroveWithoutRewards";
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

class Query<T, U, V = undefined> {
  query: DocumentNode;
  mapResult: (result: ApolloQueryResult<U>) => T;

  constructor(query: DocumentNode, mapResult: (result: ApolloQueryResult<U>) => T) {
    this.query = query;
    this.mapResult = mapResult;
  }

  get(client: ApolloClient<unknown>, variables?: V) {
    return client
      .query<U, V>({ query: this.query, variables })
      .then(result => this.mapResult(result));
  }

  watch(client: ApolloClient<unknown>, onChanged: (value: T) => void, variables?: V) {
    const subscription = client
      .watchQuery<U, V>({ query: this.query, variables })
      .subscribe(result => onChanged(this.mapResult(result)));

    return () => subscription.unsubscribe();
  }
}

const troveWithoutRewards = new Query<
  TroveWithPendingRewards,
  TroveWithoutRewards,
  TroveWithoutRewardsVariables
>(
  gql`
    query TroveWithoutRewards($address: ID!) {
      user(id: $address) {
        currentTrove {
          status
          rawCollateral
          rawDebt
          rawStake
          rawSnapshotOfTotalRedistributedCollateral
          rawSnapshotOfTotalRedistributedDebt
        }
      }
    }
  `,
  ({ data: { user } }) => {
    if (user?.currentTrove?.status === TroveStatus.open) {
      const {
        rawCollateral,
        rawDebt,
        rawStake,
        rawSnapshotOfTotalRedistributedCollateral,
        rawSnapshotOfTotalRedistributedDebt
      } = user.currentTrove;

      return new TroveWithPendingRewards({
        collateral: decimalify(rawCollateral),
        debt: decimalify(rawDebt),
        stake: decimalify(rawStake),

        snapshotOfTotalRedistributed: {
          collateral: decimalify(rawSnapshotOfTotalRedistributedCollateral),
          debt: decimalify(rawSnapshotOfTotalRedistributedDebt)
        }
      });
    } else {
      return new TroveWithPendingRewards();
    }
  }
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
      return new Trove({ collateral: 0, debt: 0, virtualDebt: 0 });
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

  constructor(uri: string, pollInterval?: number) {
    this.client = new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({ fetch, uri }),
      defaultOptions: {
        query: { fetchPolicy: "network-only" },
        watchQuery: { fetchPolicy: "network-only", pollInterval }
      }
    });
  }

  getTotalRedistributed(): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void {
    throw new Error("Method not implemented.");
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

  getTrove(address?: string): Promise<Trove> {
    throw new Error("Method not implemented.");
  }

  getNumberOfTroves(): Promise<number> {
    throw new Error("Method not implemented.");
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    throw new Error("Method not implemented.");
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

  getLastTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<(readonly [string, TroveWithPendingRewards])[]> {
    throw new Error("Method not implemented.");
  }

  getFirstTroves(
    startIdx: number,
    numberOfTroves: number
  ): Promise<(readonly [string, TroveWithPendingRewards])[]> {
    throw new Error("Method not implemented.");
  }
}
