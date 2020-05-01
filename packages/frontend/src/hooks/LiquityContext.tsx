import React, { createContext, useContext, useEffect } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { JsonRpcProvider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import {
  BatchedWeb3Provider,
  Liquity,
  deploymentOnNetwork,
  connectToContracts,
  LiquityContracts,
  DEV_CHAIN_ID
} from "@liquity/lib";

export const deployerAddress = "0x70E78E2D8B2a4fDb073B7F61c4653c23aE12DDDF";

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

export const LiquityProvider: React.FC<LiquityProviderProps> = ({ children, loader }) => {
  const { library: provider, account, chainId } = useWeb3React<JsonRpcProvider>();

  useEffect(() => {
    if (chainId && provider && provider instanceof BatchedWeb3Provider) {
      provider.setChainId(chainId);
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
