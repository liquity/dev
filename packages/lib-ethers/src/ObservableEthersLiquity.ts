import { BigNumber } from "@ethersproject/bignumber";
import { Event } from "@ethersproject/contracts";

import { Decimal } from "@liquity/decimal";
import {
  ObservableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

import { LiquityContracts } from "./contracts";
import { EthersLiquityBase } from "./EthersLiquityBase";
import { ReadableEthersLiquity } from "./ReadableEthersLiquity";

const debouncingDelayMs = 50;

const debounce = (listener: (latestBlock: number) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  let latestBlock = 0;

  return (...args: unknown[]) => {
    const event = args[args.length - 1] as Event;

    if (event.blockNumber !== undefined && event.blockNumber > latestBlock) {
      latestBlock = event.blockNumber;
    }

    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      listener(latestBlock);
      timeoutId = undefined;
    }, debouncingDelayMs);
  };
};

export class ObservableEthersLiquity extends EthersLiquityBase implements ObservableLiquity {
  private _readableLiquity: ReadableEthersLiquity;

  constructor(
    contracts: LiquityContracts,
    readableLiquity: ReadableEthersLiquity,
    userAddress?: string
  ) {
    super(contracts, userAddress);

    this._readableLiquity = readableLiquity;
  }

  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void {
    const etherSent = this._contracts.activePool.filters.EtherSent();

    const redistributionListener = debounce((blockTag: number) => {
      this._readableLiquity.getTotalRedistributed({ blockTag }).then(onTotalRedistributedChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === this._contracts.defaultPool.address) {
        redistributionListener(event);
      }
    };

    this._contracts.activePool.on(etherSent, etherSentListener);

    return () => {
      this._contracts.activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address = this._requireAddress()
  ): () => void {
    const { TroveCreated, TroveUpdated } = this._contracts.troveManager.filters;
    const troveEventFilters = [TroveCreated(address), TroveUpdated(address)];

    const troveListener = debounce((blockTag: number) => {
      this._readableLiquity.getTroveWithoutRewards(address, { blockTag }).then(onTroveChanged);
    });

    troveEventFilters.forEach(filter => this._contracts.troveManager.on(filter, troveListener));

    return () => {
      troveEventFilters.forEach(filter =>
        this._contracts.troveManager.removeListener(filter, troveListener)
      );
    };
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    const { TroveUpdated } = this._contracts.troveManager.filters;
    const troveUpdated = TroveUpdated();

    const troveUpdatedListener = debounce((blockTag: number) => {
      this._readableLiquity.getNumberOfTroves({ blockTag }).then(onNumberOfTrovesChanged);
    });

    this._contracts.troveManager.on(troveUpdated, troveUpdatedListener);

    return () => {
      this._contracts.troveManager.removeListener(troveUpdated, troveUpdatedListener);
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  watchPrice(onPriceChanged: (price: Decimal) => void): () => void {
    // TODO revisit
    // We no longer have our own PriceUpdated events. If we want to implement this in an event-based
    // manner, we'll need to listen to aggregator events directly. Or we could do polling.
    throw new Error("Method not implemented.");
  }

  watchTotal(onTotalChanged: (total: Trove) => void): () => void {
    const { TroveUpdated } = this._contracts.troveManager.filters;
    const troveUpdated = TroveUpdated();

    const totalListener = debounce((blockTag: number) => {
      this._readableLiquity.getTotal({ blockTag }).then(onTotalChanged);
    });

    this._contracts.troveManager.on(troveUpdated, totalListener);

    return () => {
      this._contracts.troveManager.removeListener(troveUpdated, totalListener);
    };
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address = this._requireAddress()
  ): () => void {
    const { UserDepositChanged } = this._contracts.stabilityPool.filters;
    const { EtherSent } = this._contracts.activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const etherSent = EtherSent();

    const depositListener = debounce((blockTag: number) => {
      this._readableLiquity
        .getStabilityDeposit(address, { blockTag })
        .then(onStabilityDepositChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === this._contracts.stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    this._contracts.stabilityPool.on(userDepositChanged, depositListener);
    this._contracts.activePool.on(etherSent, etherSentListener);

    return () => {
      this._contracts.stabilityPool.removeListener(userDepositChanged, depositListener);
      this._contracts.activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchLUSDInStabilityPool(
    onLUSDInStabilityPoolChanged: (lusdInStabilityPool: Decimal) => void
  ): () => void {
    const { Transfer } = this._contracts.lusdToken.filters;

    const transferLUSDFromStabilityPool = Transfer(this._contracts.stabilityPool.address);
    const transferLUSDToStabilityPool = Transfer(null, this._contracts.stabilityPool.address);

    const stabilityPoolLUSDFilters = [transferLUSDFromStabilityPool, transferLUSDToStabilityPool];

    const stabilityPoolLUSDListener = debounce((blockTag: number) => {
      this._readableLiquity.getLUSDInStabilityPool({ blockTag }).then(onLUSDInStabilityPoolChanged);
    });

    stabilityPoolLUSDFilters.forEach(filter =>
      this._contracts.lusdToken.on(filter, stabilityPoolLUSDListener)
    );

    return () =>
      stabilityPoolLUSDFilters.forEach(filter =>
        this._contracts.lusdToken.removeListener(filter, stabilityPoolLUSDListener)
      );
  }

  watchLUSDBalance(
    onLUSDBalanceChanged: (balance: Decimal) => void,
    address = this._requireAddress()
  ): () => void {
    const { Transfer } = this._contracts.lusdToken.filters;
    const transferLUSDFromUser = Transfer(address);
    const transferLUSDToUser = Transfer(null, address);

    const lusdTransferFilters = [transferLUSDFromUser, transferLUSDToUser];

    const lusdTransferListener = debounce((blockTag: number) => {
      this._readableLiquity.getLUSDBalance(address, { blockTag }).then(onLUSDBalanceChanged);
    });

    lusdTransferFilters.forEach(filter =>
      this._contracts.lusdToken.on(filter, lusdTransferListener)
    );

    return () =>
      lusdTransferFilters.forEach(filter =>
        this._contracts.lusdToken.removeListener(filter, lusdTransferListener)
      );
  }
}
