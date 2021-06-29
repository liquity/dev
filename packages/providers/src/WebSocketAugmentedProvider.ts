import {
  TransactionRequest,
  TransactionReceipt,
  TransactionResponse,
  BlockTag,
  EventType,
  Listener,
  Provider,
  Block
} from "@ethersproject/abstract-provider";
import { BaseProvider, Web3Provider } from "@ethersproject/providers";
import { Networkish } from "@ethersproject/networks";
import { Deferrable } from "@ethersproject/properties";
import { hexDataLength } from "@ethersproject/bytes";

import { WebSocketProvider } from "./WebSocketProvider";

export interface WebSocketAugmentedProvider extends BaseProvider {
  openWebSocket(url: string, network: Networkish): void;
  closeWebSocket(): void;
}

const webSocketAugmentedProviders: any[] = [];

export const isWebSocketAugmentedProvider = (
  provider: Provider
): provider is WebSocketAugmentedProvider =>
  webSocketAugmentedProviders.some(
    webSocketAugmentedProvider => provider instanceof webSocketAugmentedProvider
  );

const isHeaderNotFoundError = (error: any) =>
  typeof error === "object" &&
  typeof error.message === "string" &&
  (error.message.includes(
    // geth
    "header not found"
  ) ||
    error.message.includes(
      // openethereum
      "request is not supported because your node is running with state pruning"
    ));

const isTransactionHash = (eventName: EventType): eventName is string =>
  typeof eventName === "string" && hexDataLength(eventName) === 32;

const loadBalancingGlitchRetryIntervalMs = 200;
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

type BlockListenerContext = {
  isActive: () => boolean;
  removeMe: () => void;
};

const waitFor = <T, U>(f: (t: T) => Promise<U | null>) => (g: (u: U) => void) => (
  t: T,
  { isActive }: BlockListenerContext
) => {
  f(t).then(u => {
    if (u !== null && isActive()) {
      g(u);
    }
  });
};

const pass = <T>(f: (t: T) => void) => (t: T, _: BlockListenerContext) => {
  f(t);
};

const passOnce = <T>(f: (t: T) => void) => (t: T, { removeMe }: BlockListenerContext) => {
  f(t);
  removeMe();
};

const sequence = <T, U, V>(
  f: (_: (_: U) => void) => (_: T, context: BlockListenerContext) => void,
  g: (_: (_: V) => void) => (_: U, context: BlockListenerContext) => void
) => (h: (_: V) => void) => (t: T, context: BlockListenerContext) => {
  f(u => g(h)(u, context))(t, context);
};

const defer = <T>(f: (t: T) => void) => (t: T) => {
  setTimeout(() => {
    f(t);
  }, 0);
};

export const WebSocketAugmented = <T extends new (...args: any[]) => BaseProvider>(Base: T) => {
  let webSocketAugmentedProvider = class extends Base implements WebSocketAugmentedProvider {
    _wsProvider?: WebSocketProvider;
    _wsParams?: [string, Networkish];
    _reconnectTimerId: any;

    _seenBlock = 0;
    _blockListenerScheduled = false;

    readonly _blockListeners = new Map<(_: never) => void, (blockNumber: number) => void>();
    readonly _blockListener = this._onBlock.bind(this);

    openWebSocket(url: string, network: Networkish) {
      this._wsProvider = new WebSocketProvider(url, network);
      this._wsProvider.onClose = this._onWebSocketClose.bind(this);
      this._wsParams = [url, network];
      this._switchover();
    }

    _onWebSocketClose() {
      this.closeWebSocket();
      console.warn("WebSocketProvider disconnected. Retrying in 10 seconds.");
      this._reconnectTimerId = setTimeout(() => this.openWebSocket(...this._wsParams!), 10000);
    }

    closeWebSocket() {
      if (this._wsProvider) {
        this._wsProvider.onClose = null;
        this._wsProvider.close(1000); // normal closure
        this._wsProvider = undefined;
        this._switchover();

        if (this._reconnectTimerId !== undefined) {
          clearTimeout(this._reconnectTimerId);
          this._reconnectTimerId = undefined;
        }
      }
    }

    _switchover() {
      if (this._blockListeners.size > 0) {
        if (this._wsProvider) {
          super.off("block", this._blockListener);
        }
        this._startBlockEvents();
      }
    }

    _onBlock(blockNumber: number) {
      this._seenBlock = blockNumber;

      if (!this._blockListenerScheduled) {
        this._blockListenerScheduled = true;

        setTimeout(() => {
          this._blockListenerScheduled = false;
          [...this._blockListeners].forEach(([, listener]) => listener(this._seenBlock));
        }, 50);
      }
    }

    async _retrySeenBlock<T>(perform: () => Promise<T>, startingBlock: number) {
      for (let retries = 0; ; ++retries) {
        try {
          const ret = await perform();
          if (retries) {
            // console.log(`Glitch resolved after ${retries} ${retries === 1 ? "retry" : "retries"}.`);
          }
          return ret;
        } catch (error) {
          if (this._seenBlock !== startingBlock || !isHeaderNotFoundError(error)) {
            throw error;
          }
        }

        // console.warn("Load balancing glitch. Retrying...");
        await delay(loadBalancingGlitchRetryIntervalMs);
      }
    }

    async call(
      transaction: Deferrable<TransactionRequest>,
      blockTag?: BlockTag | Promise<BlockTag>
    ) {
      const resolvedBlockTag = await blockTag;

      const perform = () =>
        this._wsProvider?.isReady
          ? this._wsProvider.call(transaction, resolvedBlockTag)
          : super.call(transaction, resolvedBlockTag);

      return resolvedBlockTag === this._seenBlock
        ? this._retrySeenBlock(perform, this._seenBlock)
        : perform();
    }

    async getBalance(
      addressOrName: string | Promise<string>,
      blockTag?: BlockTag | Promise<BlockTag>
    ) {
      const resolvedBlockTag = await blockTag;

      const perform = () =>
        this._wsProvider?.isReady
          ? this._wsProvider.getBalance(addressOrName, resolvedBlockTag)
          : super.getBalance(addressOrName, resolvedBlockTag);

      return resolvedBlockTag === this._seenBlock
        ? this._retrySeenBlock(perform, this._seenBlock)
        : perform();
    }

    _startBlockEvents() {
      if (this._wsProvider) {
        console.log("Listening for new blocks on WebSocketProvider");
        this._wsProvider.on("block", this._blockListener);
      } else {
        console.log("Listening for new blocks on basic Provider");
        super.on("block", this._blockListener);
      }
    }

    _stopBlockEvents() {
      if (this._wsProvider) {
        this._wsProvider.off("block", this._blockListener);
      } else {
        super.off("block", this._blockListener);
      }
    }

    _wrap<T, U>(
      f: (t: T) => void,
      g: (f: (t: T) => void) => (u: U, { removeMe }: BlockListenerContext) => void
    ): [(t: T) => void, (u: U) => void] {
      return [
        f,
        (u: U) =>
          g(defer(f))(u, {
            isActive: () => this._blockListeners.has(f),
            removeMe: () => this._blockListeners.delete(f)
          })
      ];
    }

    on(eventName: EventType, listener: Listener) {
      if (isTransactionHash(eventName)) {
        const fetchReceipt = this._getTransactionReceiptFromLatest.bind(this, eventName);
        const [, passReceipt] = this._wrap(listener, waitFor(fetchReceipt));

        passReceipt(undefined);

        return this._addBlockListener(listener, passReceipt);
      } else if (eventName === "block") {
        return this._addBlockListener(...this._wrap(listener, pass));
      } else {
        return super.on(eventName, listener);
      }
    }

    _addBlockListener(key: (_: never) => void, blockListener: (blockNumber: number) => void) {
      if (!this._blockListeners.has(key)) {
        this._blockListeners.set(key, blockListener);

        if (this._blockListeners.size === 1) {
          this._startBlockEvents();
        }
      }
      return this;
    }

    once(eventName: EventType, listener: Listener) {
      if (isTransactionHash(eventName)) {
        const fetchReceipt = this._getTransactionReceiptFromLatest.bind(this, eventName);
        const [, passReceiptOnce] = this._wrap(listener, sequence(waitFor(fetchReceipt), passOnce));

        passReceiptOnce(undefined);

        return this._addBlockListener(listener, passReceiptOnce);
      } else if (eventName === "block") {
        return this._addBlockListener(...this._wrap(listener, passOnce));
      } else {
        return super.once(eventName, listener);
      }
    }

    off(eventName: EventType, listener: Listener) {
      if (isTransactionHash(eventName) || eventName === "block") {
        return this._removeBlockListener(listener);
      } else {
        return super.off(eventName, listener);
      }
    }

    _removeBlockListener(key: (_: never) => void) {
      if (this._blockListeners.has(key)) {
        this._blockListeners.delete(key);
        if (this._blockListeners.size === 0) {
          this._stopBlockEvents();
        }
      }
      return this;
    }

    async getTransaction(transactionHash: string | Promise<string>) {
      const txPromises: Promise<TransactionResponse | null>[] = [
        super.getTransaction(transactionHash),
        ...(this._wsProvider?.isReady ? [this._wsProvider.getTransaction(transactionHash)] : [])
      ];

      const first = await Promise.race(txPromises);
      const tx = first ?? (await Promise.all(txPromises)).find(tx => tx !== null) ?? null;

      return tx as TransactionResponse;
    }

    getTransactionReceipt(transactionHash: string | Promise<string>) {
      return this._wsProvider?.isReady
        ? this._wsProvider.getTransactionReceipt(transactionHash)
        : super.getTransactionReceipt(transactionHash);
    }

    getTransactionCount(
      addressOrName: string | Promise<string>,
      blockTag?: BlockTag | Promise<BlockTag>
    ) {
      return this._wsProvider?.isReady
        ? this._wsProvider.getTransactionCount(addressOrName, blockTag)
        : super.getTransactionCount(addressOrName, blockTag);
    }

    getBlock(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>) {
      return this._wsProvider?.isReady
        ? this._wsProvider.getBlock(blockHashOrBlockTag)
        : super.getBlock(blockHashOrBlockTag);
    }

    getBlockWithTransactions(blockHashOrBlockTag: BlockTag | string | Promise<BlockTag | string>) {
      return this._wsProvider?.isReady
        ? this._wsProvider.getBlockWithTransactions(blockHashOrBlockTag)
        : super.getBlockWithTransactions(blockHashOrBlockTag);
    }

    async _blockContainsTx(blockNumber: number, txHash: string) {
      let block: Block | null;

      for (block = null; !block; block = await this.getBlock(blockNumber)) {
        await delay(loadBalancingGlitchRetryIntervalMs);
      }

      return block.transactions.some(txHashInBlock => txHashInBlock === txHash);
    }

    async _getTransactionReceiptFromLatest(txHash: string | Promise<string>, latestBlock?: number) {
      txHash = await txHash;

      for (let retries = 0; ; ++retries) {
        const receipt = (await this.getTransactionReceipt(txHash)) as TransactionReceipt | null;

        if (
          latestBlock === undefined ||
          (receipt === null && !(await this._blockContainsTx(latestBlock, txHash))) ||
          (receipt !== null && receipt.blockNumber + receipt.confirmations - 1 >= latestBlock)
        ) {
          if (retries) {
            // console.log(`Glitch resolved after ${retries} ${retries === 1 ? "retry" : "retries"}.`);
          }
          return receipt;
        }

        // console.warn("Load balancing glitch. Retrying...");
        await delay(loadBalancingGlitchRetryIntervalMs);
      }
    }

    async waitForTransaction(txHash: string, confirmations?: number, timeout?: number) {
      if (timeout !== undefined) {
        // We don't use timeout, don't implement it
        return super.waitForTransaction(txHash, confirmations, timeout);
      }

      let latestBlock: number | undefined = undefined;
      for (;;) {
        const receipt = await this._getTransactionReceiptFromLatest(txHash, latestBlock);

        if (
          receipt !== null &&
          (confirmations === undefined || receipt.confirmations >= confirmations)
        ) {
          return receipt;
        }

        latestBlock = await new Promise<number>(resolve => this.once("block", resolve));
      }
    }
  };

  webSocketAugmentedProviders.push(webSocketAugmentedProvider);

  return webSocketAugmentedProvider;
};

export const WebSocketAugmentedWeb3Provider = WebSocketAugmented(Web3Provider);
