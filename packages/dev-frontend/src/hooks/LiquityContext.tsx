import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { Network, Networkish, networks, getNetwork as getEthersNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@fluidity/providers";
import {
  BlockPolledLiquityStore,
  EthersLiquity,
  EthersLiquityWithStore,
  _connectByChainId
} from "@fluidity/lib-ethers";

import { LiquityFrontendConfig, getConfig } from "../config";

type LiquityContextValue = {
  config: LiquityFrontendConfig;
  account: string;
  provider: Provider;
  liquity: EthersLiquityWithStore<BlockPolledLiquityStore>;
};

const LiquityContext = createContext<LiquityContextValue | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const projectNetworks: { [name: string]: Network } = {
    bakerloo: { chainId: 444900, name: "bakerloo" }
}

const getNetwork = (network: Networkish): Network => {
    if (typeof(network) === "number") {
        const standard = Object.values(projectNetworks).find((net: Network) => net.chainId == network);
        if (standard) {
            return {
                name: standard.name,
                chainId: standard.chainId,
                ensAddress: (standard.ensAddress || undefined),
                _defaultProvider: (standard._defaultProvider || undefined)
            }
        }
    }
    if (typeof(network) === "string") {
        const standard = projectNetworks[network];
        if (standard) {
            return {
                name: standard.name,
                chainId: standard.chainId,
                ensAddress: (standard.ensAddress || undefined),
                _defaultProvider: (standard._defaultProvider || undefined)
            }
        }
    }

    return getEthersNetwork(network);
}

// NOTE: Able / disable ETH networks
// const infuraSupportedNetworks = ["homestead", "kovan", "rinkeby", "ropsten", "goerli"];
const infuraSupportedNetworks = [""];
const webSocketSupportedNetworks = ["bakerloo"];

export const LiquityProvider: React.FC<LiquityProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<LiquityFrontendConfig>();

  const connection = useMemo(() => {
    if (config && provider && account && chainId) {
      try {
        return _connectByChainId(provider, provider.getSigner(account), chainId, {
          userAddress: account,
          frontendTag: config.frontendTag,
          useStore: "blockPolled"
        });
      } catch {}
    }
  }, [config, provider, account, chainId]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (config && connection) {
      const { provider, chainId } = connection;

      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);

        if (
          network.name &&
          infuraSupportedNetworks.includes(network.name) &&
          config.infuraApiKey
        ) {
          provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
        } else if (webSocketSupportedNetworks.includes(network.name)) {
          provider.openWebSocket(`wss://rpc1.bakerloo.autonity.network:8546`, chainId);
        } else if (connection._isDev) {
          provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
        }

        return () => {
          provider.closeWebSocket();
        };
      }
    }
  }, [config, connection]);

  if (!config || !provider || !account || !chainId) {
    return <>{loader}</>;
  }

  if (config.testnetOnly && chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  if (!connection) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null;
  }

  const liquity = EthersLiquity._from(connection);
  liquity.store.logging = true;

  return (
    <LiquityContext.Provider value={{ config, account, provider, liquity }}>
      {children}
    </LiquityContext.Provider>
  );
};

export const useLiquity = () => {
  const liquityContext = useContext(LiquityContext);

  if (!liquityContext) {
    throw new Error("You must provide a LiquityContext via LiquityProvider");
  }

  return liquityContext;
};
