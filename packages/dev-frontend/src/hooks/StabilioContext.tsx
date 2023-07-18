import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@stabilio/providers";
import {
  BlockPolledStabilioStore,
  EthersStabilio,
  EthersStabilioWithStore,
  _connectByChainId
} from "@stabilio/lib-ethers";

import { StabilioFrontendConfig, getConfig } from "../config";

type StabilioContextValue = {
  config: StabilioFrontendConfig;
  account: string;
  provider: Provider;
  stabilio: EthersStabilioWithStore<BlockPolledStabilioStore>;
};

const StabilioContext = createContext<StabilioContextValue | undefined>(undefined);

type StabilioProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const webSocketSupportedNetworks = ["homestead", "sepolia", "goerli"];

export const StabilioProvider: React.FC<StabilioProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<StabilioFrontendConfig>();

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
          webSocketSupportedNetworks.includes(network.name) &&
          config.infuraApiKey
        ) {
          provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
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

  const stabilio = EthersStabilio._from(connection);
  stabilio.store.logging = true;

  return (
    <StabilioContext.Provider value={{ config, account, provider, stabilio }}>
      {children}
    </StabilioContext.Provider>
  );
};

export const useStabilio = () => {
  const liquityContext = useContext(StabilioContext);

  if (!liquityContext) {
    throw new Error("You must provide a StabilioContext via StabilioProvider");
  }

  return liquityContext;
};
