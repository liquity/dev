import { AddressZero } from "@ethersproject/constants";
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
  private _provider: Provider;
  private _account: string;
  private _liquity: ReadableEthersLiquity;
  private _frontendTag: string;

  constructor(
    provider: Provider,
    account: string,
    liquity: ReadableEthersLiquity,
    frontendTag = AddressZero
  ) {
    super();

    this._provider = provider;
    this._account = account;
    this._liquity = liquity;
    this._frontendTag = frontendTag;
  }

  private _get(blockTag?: number): Promise<LiquityStoreBaseState> {
    return promiseAllValues({
      frontend: this._liquity.getFrontendStatus(this._frontendTag, { blockTag }),
      ownFrontend: this._liquity.getFrontendStatus(this._account, { blockTag }),
      accountBalance: this._provider.getBalance(this._account, blockTag).then(decimalify),
      lusdBalance: this._liquity.getLUSDBalance(this._account, { blockTag }),
      lqtyBalance: this._liquity.getLQTYBalance(this._account, { blockTag }),
      collateralSurplusBalance: this._liquity.getCollateralSurplusBalance(this._account, {
        blockTag
      }),
      price: this._liquity.getPrice({ blockTag }),
      numberOfTroves: this._liquity.getNumberOfTroves({ blockTag }),
      troveWithoutRedistribution: this._liquity.getTroveWithoutRewards(this._account, { blockTag }),
      totalRedistributed: this._liquity.getTotalRedistributed({ blockTag }),
      deposit: this._liquity.getStabilityDeposit(this._account, { blockTag }),
      total: this._liquity.getTotal({ blockTag }),
      lusdInStabilityPool: this._liquity.getLUSDInStabilityPool({ blockTag }),
      fees: this._liquity.getFees({ blockTag }),
      lqtyStake: this._liquity.getLQTYStake(this._account, { blockTag }),
      totalStakedLQTY: this._liquity.getTotalStakedLQTY({ blockTag })
    });
  }

  /** @override */
  protected _doStart(): () => void {
    this._get().then(state => {
      if (!this._loaded) {
        this._load(state, {});
      }
    });

    const blockListener = async (blockTag: number) => {
      const state = await this._get(blockTag);

      if (this._loaded) {
        this._update(state, { blockTag });
      } else {
        this._load(state, { blockTag });
      }
    };

    this._provider.on("block", blockListener);

    return () => {
      this._provider.off("block", blockListener);
    };
  }

  /** @override */
  protected _reduceExtra(
    oldState: BlockPolledLiquityStoreExtraState,
    stateUpdate: Partial<BlockPolledLiquityStoreExtraState>
  ): BlockPolledLiquityStoreExtraState {
    return { blockTag: stateUpdate.blockTag ?? oldState.blockTag };
  }
}
