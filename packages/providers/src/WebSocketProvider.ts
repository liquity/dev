import { BigNumber } from "@ethersproject/bignumber";
import {
  WebSocketProvider as EthersWebSocketProvider,
  TransactionReceipt
} from "@ethersproject/providers";
import { Event as BaseProviderEvent } from "@ethersproject/providers/lib/base-provider";

const isUnknownError = (error: any) =>
  typeof error === "object" &&
  typeof error.message === "string" &&
  error.message.includes("unknown error");

export class WebSocketProvider extends EthersWebSocketProvider {
  get isReady() {
    return (this._websocket as WebSocket).readyState === WebSocket.OPEN;
  }

  set onClose(closeListener: ((closeEvent: CloseEvent) => void) | null) {
    (this._websocket as WebSocket).onclose = closeListener;
  }

  close(code?: number) {
    (this._websocket as WebSocket).close(code);
  }

  async getTransactionReceipt(transactionHash: string | Promise<string>) {
    try {
      return await super.getTransactionReceipt(transactionHash);
    } catch (error) {
      if (isUnknownError(error)) {
        // Ethers issue:
        // https://github.com/ethers-io/ethers.js/issues/813
        return (null as unknown) as TransactionReceipt; // Ethers doesn't use strict null-checks
      } else {
        throw error;
      }
    }
  }

  _startEvent(event: BaseProviderEvent): void {
    if (event.type === "block") {
      this._subscribe("block", ["newHeads"], (result: any) => {
        this.emit("block", BigNumber.from(result.number).toNumber());
      });
    } else {
      super._startEvent(event);
    }
  }
}
