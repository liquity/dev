import { WebSocketProvider as EthersWebSocketProvider } from "@ethersproject/providers";

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

  async detectNetwork() {
    return this.network;
  }
}
