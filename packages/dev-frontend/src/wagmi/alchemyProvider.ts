// MIT License

// Copyright (c) 2023-present weth, LLC

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Chain } from "@wagmi/chains";

import type { ChainProviderFn, FallbackProviderConfig } from "@wagmi/core";

import {
  AlchemyProviderWithSepoliaSupport,
  AlchemyWebSocketProviderWithSepoliaSupport
} from "../providers/AlchemyProviderWithSepoliaSupport";

export type AlchemyProviderConfig = FallbackProviderConfig & {
  /** Your Alchemy API key from the [Alchemy Dashboard](https://dashboard.alchemyapi.io/). */
  apiKey: string;
};

export function alchemyProvider<TChain extends Chain = Chain>({
  apiKey,
  priority,
  stallTimeout,
  weight
}: AlchemyProviderConfig): ChainProviderFn<
  TChain,
  AlchemyProviderWithSepoliaSupport,
  AlchemyWebSocketProviderWithSepoliaSupport
> {
  return function (chain) {
    if (!chain.rpcUrls.alchemy?.http[0]) return null;
    return {
      chain: {
        ...chain,
        rpcUrls: {
          ...chain.rpcUrls,
          default: { http: [`${chain.rpcUrls.alchemy?.http[0]}/${apiKey}`] }
        }
      } as TChain,
      provider: () => {
        const provider = new AlchemyProviderWithSepoliaSupport(
          {
            chainId: chain.id,
            name: chain.network,
            ensAddress: chain.contracts?.ensRegistry?.address
          },
          apiKey
        );
        return Object.assign(provider, { priority, stallTimeout, weight });
      },
      webSocketProvider: () =>
        new AlchemyWebSocketProviderWithSepoliaSupport(
          {
            chainId: chain.id,
            name: chain.network,
            ensAddress: chain.contracts?.ensRegistry?.address
          },
          apiKey
        )
    };
  };
}
