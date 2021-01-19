import React, { createContext, useContext } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { Web3Provider } from "@ethersproject/providers";
import { useWeb3React } from "@web3-react/core";

import { EthersLiquity, deploymentOnNetwork, connectToContracts } from "@liquity/lib-ethers";

type LiquityContextValue = {
  account: string;
  provider: Provider;
  liquity: EthersLiquity;
};

const LiquityContext = createContext<LiquityContextValue | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: (chainId: number) => React.ReactNode;
};

export const LiquityProvider: React.FC<LiquityProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback
}) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();

  if (!provider || !account || !chainId) {
    return <>{loader}</>;
  }

  const deployment = deploymentOnNetwork[chainId];

  if (deployment === undefined) {
    return unsupportedNetworkFallback ? <>{unsupportedNetworkFallback(chainId)}</> : null;
  }

  const { addresses, priceFeedIsTestnet } = deployment;
  const signer = provider.getSigner(account);
  const contracts = connectToContracts(addresses, priceFeedIsTestnet, signer);
  const liquity = EthersLiquity.from(contracts, signer, account);

  return (
    <LiquityContext.Provider
      value={{
        account,
        provider,
        liquity
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
