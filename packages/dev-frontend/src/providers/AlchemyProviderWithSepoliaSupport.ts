import { Network, Networkish } from "@ethersproject/networks";
import { defineReadOnly } from "@ethersproject/properties";
import type { ConnectionInfo } from "@ethersproject/web";

import {
  AlchemyProvider,
  WebSocketProvider,
  CommunityResourcable,
  showThrottleMessage
} from "@ethersproject/providers";

const defaultApiKey = "_gg7wSSi0KMBsdKnGVfHDueq6xMB9EkC";

export class AlchemyWebSocketProviderWithSepoliaSupport
  extends WebSocketProvider
  implements CommunityResourcable {
  readonly apiKey!: string;

  constructor(network?: Networkish, apiKey?: any) {
    const provider = new AlchemyProvider(network, apiKey);

    const url = provider.connection.url
      .replace(/^http/i, "ws")
      .replace(".alchemyapi.", ".ws.alchemyapi.");

    super(url, provider.network);
    defineReadOnly(this, "apiKey", provider.apiKey);
  }

  isCommunityResource(): boolean {
    return this.apiKey === defaultApiKey;
  }
}

export class AlchemyProviderWithSepoliaSupport extends AlchemyProvider {
  static getUrl(network: Network, apiKey: string): ConnectionInfo {
    let host = null;
    switch (network.name) {
      case "sepolia":
        host = "eth-sepolia.g.alchemy.com/v2/";
        break;
      default:
        return AlchemyProvider.getUrl(network, apiKey);
    }

    return {
      allowGzip: true,
      url: "https:/" + "/" + host + apiKey,
      throttleCallback: () => {
        if (apiKey === defaultApiKey) {
          showThrottleMessage();
        }
        return Promise.resolve(true);
      }
    };
  }
}
