import fetch from "cross-fetch";
import { gql, ApolloClient, InMemoryCache, NormalizedCacheObject, HttpLink } from "@apollo/client";
import { getAddress } from "@ethersproject/address";
import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/decimal";

import { Query } from "./Query";

import {
  ReadableLiquity,
  ObservableLiquity,
  TroveWithPendingRewards,
  Trove,
  _emptyTrove,
  StabilityDeposit,
  Fees,
  LQTYStake,
  FrontendStatus
} from "@liquity/lib-base";

import { OrderDirection } from "../types/globalTypes";
import { Global } from "../types/Global";
import { TroveRawFields } from "../types/TroveRawFields";
import { TroveWithoutRewards, TroveWithoutRewardsVariables } from "../types/TroveWithoutRewards";
import { Troves, TrovesVariables } from "../types/Troves";
import { BlockNumberDummy, BlockNumberDummyVariables } from "../types/BlockNumberDummy";

const normalizeAddress = (address?: string) => {
  if (address === undefined) {
    throw new Error("An address is required");
  }

  return address.toLowerCase();
};

const decimalify = (bigNumberString: string) => new Decimal(BigNumber.from(bigNumberString));

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
  new TroveWithPendingRewards(
    decimalify(rawCollateral),
    decimalify(rawDebt),
    decimalify(rawStake),

    new Trove(
      decimalify(rawSnapshotOfTotalRedistributedCollateral),
      decimalify(rawSnapshotOfTotalRedistributedDebt)
    )
  );

const troveWithoutRewards = new Query<
  TroveWithPendingRewards,
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
      return new TroveWithPendingRewards();
    }
  }
);

const troves = new Query<[string, TroveWithPendingRewards][], Troves, TrovesVariables>(
  gql`
    query Troves($orderDirection: OrderDirection!, $startIdx: Int!, $numberOfTroves: Int!) {
      troves(
        where: { status: open }
        orderBy: collateralRatioSortKey
        orderDirection: $orderDirection
        skip: $startIdx
        first: $numberOfTroves
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
