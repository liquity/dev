import {
  TransactionRequest,
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

export const WebSocketAugmented = <T extends new (...args: any[]) => BaseProvider>(Base: T) => {
  let webSocketAugmentedProvider = class extends Base implements WebSocketAugmentedProvider {
    _wsProvider?: WebSocketProvider;
    _wsParams?: [string, Networkish];
    _reconnectTimerId: any;

    readonly _blockListeners = new Set<(blockNumber: number) => void>();
    readonly _blockListener = this._tellBlockListeners.bind(this);

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

    _tellBlockListeners(blockNumber: number) {
      this._blockListeners.forEach(listener => listener(blockNumber));
    }

    call(...args: [TransactionRequest | Promise<TransactionRequest>, BlockTag | Promise<BlockTag>]) {
      return this._wsProvider?.isReady ? this._wsProvider.call(...args) : super.call(...args);
    }

    getBalance(...args: [string | Promise<string>, BlockTag | Promise<BlockTag>]) {
      return this._wsProvider?.isReady
        ? this._wsProvider.getBalance(...args)
        : super.getBalance(...args);
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
        return this._onBlock(listener);
      } else {
        return super.on(eventName, listener);
      }
    }

    _onBlock(listener: (blockNumber: number) => void) {
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
          this._offBlock(listenOnce);
        };
        return this._onBlock(listenOnce);
      } else {
        return super.once(eventName, listener);
      }
    }

    off(eventName: EventType, listener: Listener) {
      if (eventName === "block") {
        return this._offBlock(listener);
      } else {
        return super.off(eventName, listener);
      }
    }

    _offBlock(listener: (blockNumber: number) => void) {
      if (this._blockListeners.has(listener)) {
        this._blockListeners.delete(listener);
        if (this._blockListeners.size === 0) {
          this._stopBlockEvents();
        }
      }
      return this;
    }
  };

  webSocketAugmentedProviders.push(webSocketAugmentedProvider);

  return webSocketAugmentedProvider;
};

export const WebSocketAugmentedWeb3Provider = WebSocketAugmented(Web3Provider);
