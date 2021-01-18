import React, { createContext, useContext, useEffect, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { isBatchedProvider, isWebSocketAugmentedProvider } from "@liquity/providers";
import {
  EthersLiquity,
  deploymentOnNetwork,
  connectToContracts,
  LiquityContracts,
  DEV_CHAIN_ID
} from "@liquity/lib-ethers";

import { LiquityFrontendConfig, getConfig } from "../config";

type LiquityContextValue = {
  config: LiquityFrontendConfig;
  account: string;
  provider: Provider;
  contracts: LiquityContracts;
  liquity: EthersLiquity;
  contractsVersion: string;
  deploymentDate: number;
};

const LiquityContext = createContext<LiquityContextValue | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

export const LiquityProvider: React.FC<LiquityProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();
  const [config, setConfig] = useState<LiquityFrontendConfig>();

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (config && provider && chainId) {
      if (isBatchedProvider(provider)) {
        provider.chainId = chainId;
      }

      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);

        if (network.name && network.name !== "unknown" && config.infuraApiKey) {
          provider.openWebSocket(...wsParams(network.name, config.infuraApiKey));
        } else if (chainId === DEV_CHAIN_ID) {
          provider.openWebSocket(`ws://${window.location.hostname}:8546`, chainId);
        }

        return () => {
          provider.closeWebSocket();
        };
      }
    }
  }, [config, provider, chainId]);

  if (!config || !provider || !account || !chainId) {
    return <>{loader}</>;
  }

  const deployment = deploymentOnNetwork[chainId];

  if (deployment === undefined) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null;
  }

  const { addresses, version: contractsVersion, deploymentDate, priceFeedIsTestnet } = deployment;
  const signer = provider.getSigner(account);
  const contracts = connectToContracts(addresses, priceFeedIsTestnet, signer);
  const liquity = EthersLiquity.from(contracts, signer, account);

  return (
    <LiquityContext.Provider
      value={{
        config,
        account,
        provider,
        contracts,
        liquity,
        contractsVersion,
        deploymentDate
      }}
    >
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
