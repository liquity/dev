import React, { createContext, useContext, useEffect } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import {
  Liquity,
  deploymentOnNetwork,
  connectToContracts,
  LiquityContracts,
  DEV_CHAIN_ID,
  isBatchedProvider,
  isWebSocketAugmentedProvider
} from "@liquity/lib";

type LiquityContext = {
  account: string;
  provider: Provider;
  contracts: LiquityContracts;
  liquity: Liquity;
  devChain: boolean;
  contractsVersion: string;
  deploymentDate: number;
};

const LiquityContext = createContext<LiquityContext | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
};

const infuraApiKey = "ad9cef41c9c844a7b54d10be24d416e5";
const wsParams = (network: string) =>
  [`wss://${network}.infura.io/ws/v3/${infuraApiKey}`, network] as const;

export const LiquityProvider: React.FC<LiquityProviderProps> = ({ children, loader }) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();

  useEffect(() => {
    if (provider && chainId) {
      if (isBatchedProvider(provider)) {
        provider.chainId = chainId;
      }
      if (isWebSocketAugmentedProvider(provider)) {
        const network = getNetwork(chainId);
        if (network.name && network.name !== "unknown") {
          provider.openWebSocket(...wsParams(network.name));
        }
      }
    }
  }, [provider, chainId]);

  if (!provider || !account || !chainId) {
    return <>{loader}</>;
  }

  const { addresses, version: contractsVersion, deploymentDate } = deploymentOnNetwork[chainId];
  const contracts = connectToContracts(addresses, provider.getSigner(account));
  const liquity = new Liquity(contracts, account);
  const devChain = chainId === DEV_CHAIN_ID;

  return (
    <LiquityContext.Provider
      value={{ account, provider, contracts, liquity, devChain, contractsVersion, deploymentDate }}
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
