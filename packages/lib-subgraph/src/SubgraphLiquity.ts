import fetch from "cross-fetch";
import { ApolloClient, gql, HttpLink, InMemoryCache, NormalizedCacheObject } from "@apollo/client";
import { getAddress } from "@ethersproject/address";

import {
  Decimal,
  Fees,
  FrontendStatus,
  LQTYStake,
  ObservableLiquity,
  ReadableLiquity,
  StabilityDeposit,
  Trove,
  TroveListingParams,
  TroveWithPendingRedistribution,
  _emptyTrove
} from "@liquity/lib-base";

import { OrderDirection } from "../types/globalTypes";
import { Global } from "../types/Global";
import { BlockNumberDummy, BlockNumberDummyVariables } from "../types/BlockNumberDummy";
import { TroveRawFields } from "../types/TroveRawFields";
import { Troves, TrovesVariables } from "../types/Troves";
import { TroveWithoutRewards, TroveWithoutRewardsVariables } from "../types/TroveWithoutRewards";

import { Query } from "./Query";

const normalizeAddress = (address?: string) => {
  if (address === undefined) {
    throw new Error("An address is required");
  }

  return address.toLowerCase();
};

const decimalify = (bigNumberString: string) => Decimal.fromBigNumberString(bigNumberString);

const queryGlobal = gql`
  query Global {
    global(id: "only") {
      id
      numberOfOpenTroves
      rawTotalRedistributedCollateral
      rawTotalRedistributedDebt

      currentSystemState {
        id
        price
        totalCollateral
        totalDebt
        tokensInStabilityPool
      }
    }
  }
`;

const numberOfTroves = new Query<number, Global>(
  queryGlobal,
  ({ data: { global } }) => global?.numberOfOpenTroves ?? 0
);

const totalRedistributed = new Query<Trove, Global>(queryGlobal, ({ data: { global } }) => {
  if (global) {
    const { rawTotalRedistributedCollateral, rawTotalRedistributedDebt } = global;

    return new Trove(
      decimalify(rawTotalRedistributedCollateral),
      decimalify(rawTotalRedistributedDebt)
    );
  } else {
    return _emptyTrove;
  }
});

const price = new Query<Decimal, Global>(queryGlobal, ({ data: { global } }) =>
  Decimal.from(global?.currentSystemState?.price ?? 200)
);

const total = new Query<Trove, Global>(queryGlobal, ({ data: { global } }) => {
  if (global?.currentSystemState) {
    const { totalCollateral, totalDebt } = global.currentSystemState;

    return new Trove(totalCollateral, totalDebt);
  } else {
    return _emptyTrove;
  }
});

const tokensInStabilityPool = new Query<Decimal, Global>(queryGlobal, ({ data: { global } }) =>
  Decimal.from(global?.currentSystemState?.tokensInStabilityPool ?? 0)
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
  new TroveWithPendingRedistribution(
    decimalify(rawCollateral),
    decimalify(rawDebt),
    decimalify(rawStake),

    new Trove(
      decimalify(rawSnapshotOfTotalRedistributedCollateral),
      decimalify(rawSnapshotOfTotalRedistributedDebt)
    )
  );

const troveBeforeRedistribution = new Query<
  TroveWithPendingRedistribution,
  TroveWithoutRewards,
  TroveWithoutRewardsVariables
>(
  gql`
    query TroveWithoutRewards($address: ID!) {
      user(id: $address) {
        id
        currentTrove {
          id
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
      return new TroveWithPendingRedistribution();
    }
  }
);

const troves = new Query<[string, TroveWithPendingRedistribution][], Troves, TrovesVariables>(
  gql`
    query Troves($orderDirection: OrderDirection!, $startingAt: Int!, $first: Int!) {
      troves(
        where: { status: open }
        orderBy: collateralRatioSortKey
        orderDirection: $orderDirection
        skip: $startingAt
        first: $first
      ) {
        id
        owner {
          id
        }
        ...TroveRawFields
      }
    }
    ${troveRawFields}
  `,
  ({ data: { troves } }) =>
    troves.map(({ owner: { id }, ...rawFields }) => [getAddress(id), troveFromRawFields(rawFields)])
);

const blockNumberDummy = new Query<void, BlockNumberDummy, BlockNumberDummyVariables>(
  gql`
    query BlockNumberDummy($blockNumber: Int!) {
      globals(block: { number: $blockNumber }) {
        id
      }
    }
  `,
  () => {}
);

export class SubgraphLiquity implements ReadableLiquity, ObservableLiquity {
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

  getTroveBeforeRedistribution(address?: string) {
    return troveBeforeRedistribution.get(this.client, { address: normalizeAddress(address) });
  }

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address?: string
  ) {
    return troveBeforeRedistribution.watch(this.client, onTroveChanged, {
      address: normalizeAddress(address)
    });
  }

  async getTrove(address?: string) {
    const [trove, totalRedistributed] = await Promise.all([
      this.getTroveBeforeRedistribution(address),
      this.getTotalRedistributed()
    ] as const);

    return trove.applyRedistribution(totalRedistributed);
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
    onStabilityDepositChanged: (stabilityDeposit: StabilityDeposit) => void,
    address?: string
  ): () => void {
    throw new Error("Method not implemented.");
  }

  getLUSDInStabilityPool() {
    return tokensInStabilityPool.get(this.client);
  }

  watchLUSDInStabilityPool(onLUSDInStabilityPoolChanged: (lusdInStabilityPool: Decimal) => void) {
    return tokensInStabilityPool.watch(this.client, onLUSDInStabilityPoolChanged);
  }

  getLUSDBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  watchLUSDBalance(onLUSDBalanceChanged: (balance: Decimal) => void, address?: string): () => void {
    throw new Error("Method not implemented.");
  }

  getLQTYBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getCollateralSurplusBalance(address?: string): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getTroves(
    params: TroveListingParams & { beforeRedistribution: true }
  ): Promise<[address: string, trove: TroveWithPendingRedistribution][]>;

  getTroves(params: TroveListingParams): Promise<[address: string, trove: Trove][]>;

  async getTroves(params: TroveListingParams) {
    const { first, sortedBy, startingAt = 0, beforeRedistribution } = params;

    const [totalRedistributed, _troves] = await Promise.all([
      beforeRedistribution ? undefined : this.getTotalRedistributed(),
      troves.get(this.client, {
        first,
        startingAt,
        orderDirection:
          sortedBy === "ascendingCollateralRatio" ? OrderDirection.asc : OrderDirection.desc
      })
    ]);

    if (totalRedistributed) {
      return _troves.map(([address, trove]) => [
        address,
        trove.applyRedistribution(totalRedistributed)
      ]);
    } else {
      return _troves;
    }
  }

  async waitForBlock(blockNumber: number) {
    for (;;) {
      try {
        await blockNumberDummy.get(this.client, { blockNumber });
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      return;
    }
  }

  _getFeesInNormalMode(): Promise<Fees> {
    throw new Error("Method not implemented.");
  }

  getFees(): Promise<Fees> {
    throw new Error("Method not implemented.");
  }

  getLQTYStake(address?: string): Promise<LQTYStake> {
    throw new Error("Method not implemented.");
  }

  getTotalStakedLQTY(): Promise<Decimal> {
    throw new Error("Method not implemented.");
  }

  getFrontendStatus(address?: string): Promise<FrontendStatus> {
    throw new Error("Method not implemented.");
  }
}
