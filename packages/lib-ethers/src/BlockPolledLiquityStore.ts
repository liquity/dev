import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import { LiquityStore, LiquityStoreState, LiquityStoreBaseState } from "@liquity/lib-base";

import { ReadableEthersLiquity } from "./ReadableEthersLiquity";

export type BlockPolledLiquityStoreExtraState = {
  blockTag?: number;
};

export type BlockPolledLiquityStoreState = LiquityStoreState<BlockPolledLiquityStoreExtraState>;

type Resolved<T> = T extends Promise<infer U> ? U : T;
type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

const promiseAllValues = <T>(object: T) => {
  const keys = Object.keys(object);

  return Promise.all(Object.values(object)).then(values =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

export class BlockPolledLiquityStore extends LiquityStore<BlockPolledLiquityStoreExtraState> {
  private provider: Provider;
  private account: string;
  private liquity: ReadableEthersLiquity;

  constructor(provider: Provider, account: string, liquity: ReadableEthersLiquity) {
    super();

    this.provider = provider;
    this.account = account;
    this.liquity = liquity;
  }

  private get(blockTag?: number): Promise<LiquityStoreBaseState> {
    return promiseAllValues({
      accountBalance: this.provider.getBalance(this.account, blockTag).then(decimalify),
      lusdBalance: this.liquity.getLUSDBalance(this.account, { blockTag }),
      price: this.liquity.getPrice({ blockTag }),
      numberOfTroves: this.liquity.getNumberOfTroves({ blockTag }),
      troveWithoutRewards: this.liquity.getTroveWithoutRewards(this.account, { blockTag }),
      totalRedistributed: this.liquity.getTotalRedistributed({ blockTag }),
      deposit: this.liquity.getStabilityDeposit(this.account, { blockTag }),
      total: this.liquity.getTotal({ blockTag }),
      lusdInStabilityPool: this.liquity.getLUSDInStabilityPool({ blockTag })
    });
  }

  start() {
    this.get().then(state => {
      if (!this.loaded) {
        this.load(state, {});
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this.get(blockTag);

      if (this.loaded) {
        this.update(state, { blockTag });
      } else {
        this.load(state, { blockTag });
      }
    };

    this.provider.on("block", blockListener);

    return () => {
      this.provider.off("block", blockListener);
    };
  }

  protected reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return { blockTag: stateUpdate.blockTag ?? oldState.blockTag };
  }
}
