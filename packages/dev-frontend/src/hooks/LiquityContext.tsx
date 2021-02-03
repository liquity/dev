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
  DEV_CHAIN_ID,
  BlockPolledLiquityStore,
  ReadableEthersLiquity,
  PopulatableEthersLiquity,
  LiquityDeployment
} from "@liquity/lib-ethers";

import { LiquityFrontendConfig, getConfig } from "../config";

type LiquityContextValue = {
  config: LiquityFrontendConfig;
  account: string;
  provider: Provider;
  deployment: LiquityDeployment;
  contracts: LiquityContracts;
  liquity: EthersLiquity;
  store: BlockPolledLiquityStore;
};

const LiquityContext = createContext<LiquityContextValue | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
};

const wsParams = (network: string, infuraApiKey: string): [string, string] => [
  `wss://${network === "homestead" ? "mainnet" : network}.infura.io/ws/v3/${infuraApiKey}`,
  network
];

const supportedNetworks = ["homestead", "kovan", "rinkeby", "ropsten", "goerli"];

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

        if (network.name && supportedNetworks.includes(network.name) && config.infuraApiKey) {
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

  const signer = provider.getSigner(account);

  const contracts = connectToContracts(deployment.addresses, deployment.priceFeedIsTestnet, signer);
  const readable = new ReadableEthersLiquity(contracts, account);
  const store = new BlockPolledLiquityStore(provider, account, readable, config.frontendTag);
  const populatable = new PopulatableEthersLiquity(contracts, readable, signer, store);
  const liquity = new EthersLiquity(readable, populatable);

  store.logging = true;

  return (
    <LiquityContext.Provider
      value={{
        config,
        account,
        provider,
        deployment,
        contracts,
        liquity,
        store
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
