import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import { LiquityStore, LiquityStoreState } from "@liquity/lib-base";

import { EthersLiquity } from "./EthersLiquity";

export type BlockPolledLiquityStoreExtraState = {
  blockTag?: number;
};

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
  private liquity: EthersLiquity;

  constructor(provider: Provider, account: string, liquity: EthersLiquity) {
    super();
    this.provider = provider;
    this.account = account;
    this.liquity = liquity;
  }

  private get(blockTag?: number): Promise<LiquityStoreState> {
    return promiseAllValues({
      accountBalance: this.provider.getBalance(this.account, blockTag).then(decimalify),
      quiBalance: this.liquity.getQuiBalance(this.account, { blockTag }),
      price: this.liquity.getPrice({ blockTag }),
      numberOfTroves: this.liquity.getNumberOfTroves({ blockTag }),
      troveWithoutRewards: this.liquity.getTroveWithoutRewards(this.account, { blockTag }),
      totalRedistributed: this.liquity.getTotalRedistributed({ blockTag }),
      deposit: this.liquity.getStabilityDeposit(this.account, { blockTag }),
      total: this.liquity.getTotal({ blockTag }),
      quiInStabilityPool: this.liquity.getQuiInStabilityPool({ blockTag })
    });
  }

  start() {
    this.get().then(state => {
      if (!this.loaded) {
        this.load(state);
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
