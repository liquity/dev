import { BigNumber } from "@ethersproject/bignumber";
import { Event } from "@ethersproject/contracts";

import { Decimal } from "@liquity/decimal";
import {
  ObservableLiquity,
  StabilityDeposit,
  Trove,
  TroveWithPendingRedistribution
} from "@liquity/lib-base";

import { LiquityConnection, _getContracts } from "./contracts";
import { _EthersLiquityBase } from "./EthersLiquityBase";
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

/** @alpha */
export class ObservableEthersLiquity extends _EthersLiquityBase implements ObservableLiquity {
  private _readableLiquity: ReadableEthersLiquity;

  constructor(
    connection: LiquityConnection,
    readableLiquity: ReadableEthersLiquity,
    userAddress?: string
  ) {
    super(connection, userAddress);

    this._readableLiquity = readableLiquity;
  }

  watchTotalRedistributed(
    onTotalRedistributedChanged: (totalRedistributed: Trove) => void
  ): () => void {
    const { activePool, defaultPool } = _getContracts(this._connection);
    const etherSent = activePool.filters.EtherSent();

    const redistributionListener = debounce((blockTag: number) => {
      this._readableLiquity.getTotalRedistributed({ blockTag }).then(onTotalRedistributedChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === defaultPool.address) {
        redistributionListener(event);
      }
    };

    activePool.on(etherSent, etherSentListener);

    return () => {
      activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchTroveWithoutRewards(
    onTroveChanged: (trove: TroveWithPendingRedistribution) => void,
    address = this._requireAddress()
  ): () => void {
    const { troveManager } = _getContracts(this._connection);
    const { TroveCreated, TroveUpdated } = troveManager.filters;
    const troveEventFilters = [TroveCreated(address), TroveUpdated(address)];

    const troveListener = debounce((blockTag: number) => {
      this._readableLiquity.getTroveWithoutRewards(address, { blockTag }).then(onTroveChanged);
    });

    troveEventFilters.forEach(filter => troveManager.on(filter, troveListener));

    return () => {
      troveEventFilters.forEach(filter => troveManager.removeListener(filter, troveListener));
    };
  }

  watchNumberOfTroves(onNumberOfTrovesChanged: (numberOfTroves: number) => void): () => void {
    const { troveManager } = _getContracts(this._connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const troveUpdatedListener = debounce((blockTag: number) => {
      this._readableLiquity.getNumberOfTroves({ blockTag }).then(onNumberOfTrovesChanged);
    });

    troveManager.on(troveUpdated, troveUpdatedListener);

    return () => {
      troveManager.removeListener(troveUpdated, troveUpdatedListener);
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
    const { troveManager } = _getContracts(this._connection);
    const { TroveUpdated } = troveManager.filters;
    const troveUpdated = TroveUpdated();

    const totalListener = debounce((blockTag: number) => {
      this._readableLiquity.getTotal({ blockTag }).then(onTotalChanged);
    });

    troveManager.on(troveUpdated, totalListener);

    return () => {
      troveManager.removeListener(troveUpdated, totalListener);
    };
  }

  watchStabilityDeposit(
    onStabilityDepositChanged: (deposit: StabilityDeposit) => void,
    address = this._requireAddress()
  ): () => void {
    const { activePool, stabilityPool } = _getContracts(this._connection);
    const { UserDepositChanged } = stabilityPool.filters;
    const { EtherSent } = activePool.filters;

    const userDepositChanged = UserDepositChanged(address);
    const etherSent = EtherSent();

    const depositListener = debounce((blockTag: number) => {
      this._readableLiquity
        .getStabilityDeposit(address, { blockTag })
        .then(onStabilityDepositChanged);
    });

    const etherSentListener = (toAddress: string, _amount: BigNumber, event: Event) => {
      if (toAddress === stabilityPool.address) {
        // Liquidation while Stability Pool has some deposits
        // There may be new gains
        depositListener(event);
      }
    };

    stabilityPool.on(userDepositChanged, depositListener);
    activePool.on(etherSent, etherSentListener);

    return () => {
      stabilityPool.removeListener(userDepositChanged, depositListener);
      activePool.removeListener(etherSent, etherSentListener);
    };
  }

  watchLUSDInStabilityPool(
    onLUSDInStabilityPoolChanged: (lusdInStabilityPool: Decimal) => void
  ): () => void {
    const { lusdToken, stabilityPool } = _getContracts(this._connection);
    const { Transfer } = lusdToken.filters;

    const transferLUSDFromStabilityPool = Transfer(stabilityPool.address);
    const transferLUSDToStabilityPool = Transfer(null, stabilityPool.address);

    const stabilityPoolLUSDFilters = [transferLUSDFromStabilityPool, transferLUSDToStabilityPool];

    const stabilityPoolLUSDListener = debounce((blockTag: number) => {
      this._readableLiquity.getLUSDInStabilityPool({ blockTag }).then(onLUSDInStabilityPoolChanged);
    });

    stabilityPoolLUSDFilters.forEach(filter => lusdToken.on(filter, stabilityPoolLUSDListener));

    return () =>
      stabilityPoolLUSDFilters.forEach(filter =>
        lusdToken.removeListener(filter, stabilityPoolLUSDListener)
      );
  }

  watchLUSDBalance(
    onLUSDBalanceChanged: (balance: Decimal) => void,
    address = this._requireAddress()
  ): () => void {
    const { lusdToken } = _getContracts(this._connection);
    const { Transfer } = lusdToken.filters;
    const transferLUSDFromUser = Transfer(address);
    const transferLUSDToUser = Transfer(null, address);

    const lusdTransferFilters = [transferLUSDFromUser, transferLUSDToUser];

    const lusdTransferListener = debounce((blockTag: number) => {
      this._readableLiquity.getLUSDBalance(address, { blockTag }).then(onLUSDBalanceChanged);
    });

    lusdTransferFilters.forEach(filter => lusdToken.on(filter, lusdTransferListener));

    return () =>
      lusdTransferFilters.forEach(filter => lusdToken.removeListener(filter, lusdTransferListener));
  }
}
