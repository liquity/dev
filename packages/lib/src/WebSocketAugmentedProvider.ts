import {
  TransactionRequest,
  TransactionReceipt,
  BlockTag,
  EventType,
  Listener,
  Provider
} from "@ethersproject/abstract-provider";
import { BaseProvider, Web3Provider } from "@ethersproject/providers";
import { Networkish } from "@ethersproject/networks";

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
  error.message.includes("header not found");

export const WebSocketAugmented = <T extends new (...args: any[]) => BaseProvider>(Base: T) => {
  let webSocketAugmentedProvider = class extends Base implements WebSocketAugmentedProvider {
    _wsProvider?: WebSocketProvider;
    _wsParams?: [string, Networkish];
    _reconnectTimerId: any;

    _seenBlock = 0;

    readonly _blockListeners = new Set<(blockNumber: number) => void>();
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
      [...this._blockListeners].forEach(listener => listener(blockNumber));
    }

    async _retrySeenBlock<T>(perform: () => Promise<T>, startingBlock: number) {
      for (let retries = 0; ; ++retries) {
        try {
          const ret = await perform();
          if (retries) {
            console.log(`Glitch resolved after ${retries} ${retries === 1 ? "retry" : "retries"}.`);
          }
          return ret;
        } catch (error) {
          if (this._seenBlock !== startingBlock || !isHeaderNotFoundError(error)) {
            throw error;
          }
        }

        console.warn(`Load balancing glitch. Retrying...`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    async call(
      transaction: TransactionRequest | Promise<TransactionRequest>,
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

    on(eventName: EventType, listener: Listener) {
      if (eventName === "block") {
        return this._addBlockListener(listener);
      } else {
        return super.on(eventName, listener);
      }
    }

    _addBlockListener(listener: (blockNumber: number) => void) {
      if (!this._blockListeners.has(listener)) {
        this._blockListeners.add(listener);
        if (this._blockListeners.size === 1) {
          this._startBlockEvents();
        }
      }
      return this;
    }

    once(eventName: EventType, listener: Listener) {
      if (eventName === "block") {
        const listenOnce = (blockNumber: number) => {
          listener(blockNumber);
          this._removeBlockListener(listenOnce);
        };
        return this._addBlockListener(listenOnce);
      } else {
        return super.once(eventName, listener);
      }
    }

    off(eventName: EventType, listener: Listener) {
      if (eventName === "block") {
        return this._removeBlockListener(listener);
      } else {
        return super.off(eventName, listener);
      }
    }

    _removeBlockListener(listener: (blockNumber: number) => void) {
      if (this._blockListeners.has(listener)) {
        this._blockListeners.delete(listener);
        if (this._blockListeners.size === 0) {
          this._stopBlockEvents();
        }
      }
      return this;
    }

    getTransactionReceipt(transactionHash: string | Promise<string>) {
      return this._wsProvider?.ready
        ? this._wsProvider.getTransactionReceipt(transactionHash)
        : super.getTransactionReceipt(transactionHash);
    }

    async waitForTransaction(txHash: string, confirmations?: number, timeout?: number) {
      if (timeout !== undefined) {
        // We don't use timeout, don't implement it
        return super.waitForTransaction(txHash, confirmations, timeout);
      }

      for (;;) {
        await new Promise(resolve => setTimeout(resolve, 10));

        const receipt = (await this.getTransactionReceipt(txHash)) as TransactionReceipt | null;

        if (
          receipt !== null &&
          (confirmations === undefined || receipt.confirmations >= confirmations)
        ) {
          return receipt;
        }

        await new Promise(resolve => this.once("block", resolve));
      }
    }
  };

  webSocketAugmentedProviders.push(webSocketAugmentedProvider);

  return webSocketAugmentedProvider;
};

export const WebSocketAugmentedWeb3Provider = WebSocketAugmented(Web3Provider);
