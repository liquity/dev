import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { BaseProvider, Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@liquity/providers";
import {
  BlockPolledLiquityStore,
  EthersLiquity,
  EthersLiquityWithStore,
  _connectByChainId
} from "@liquity/lib-ethers";

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

const webSocketSupportedNetworks = ["homestead", "kovan", "rinkeby", "ropsten", "goerli"];

const getClientVersion = async (provider: BaseProvider): Promise<string | undefined> => {
  try {
    const clientVersion = await provider.perform("web3_clientVersion", []);

    if (typeof clientVersion === "string") {
      return clientVersion;
    }
  } catch {}
};

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
    if (!config || !connection) {
      return;
    }

    let mounted = true;
    let wsOpen = false;

    const setupProvider = async () => {
      const { provider, chainId } = connection;

      if (isBatchedProvider(provider) && provider.chainId !== chainId) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);
        const clientVersion = await getClientVersion(provider);

        if (!mounted) {
          return;
        }

        // If client is HardHat, assume that it's running in fork mode, therefore don't use an
        // Infura WebSocket connection, as that would see a different (unforked) blockchain state.
        if (!clientVersion || !clientVersion.match(/hardhat/i)) {
          if (
            network.name &&
            webSocketSupportedNetworks.includes(network.name) &&
            config.infuraApiKey
          ) {
            provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
            wsOpen = true;
          } else if (connection._isDev) {
            provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
            wsOpen = true;
          }
        }
      }
    };

    setupProvider();

    return () => {
      const { provider } = connection;

      if (isWebSocketAugmentedProvider(provider) && wsOpen) {
        provider.closeWebSocket();
      }

      mounted = false;
    };
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
