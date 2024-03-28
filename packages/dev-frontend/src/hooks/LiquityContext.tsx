import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { Web3Provider } from "@ethersproject/providers";
import { useClient, useAccount, useChainId, useWalletClient } from "wagmi";

import {
  BlockPolledLiquityStore,
  EthersLiquity,
  EthersLiquityWithStore,
  _connectByChainId
} from "@liquity/lib-ethers";

import { LiquityFrontendConfig, getConfig } from "../config";
import { BatchedProvider } from "../providers/BatchingProvider";

type LiquityContextValue = {
  config: LiquityFrontendConfig;
  account: string;
  provider: Provider;
  liquity: EthersLiquityWithStore<BlockPolledLiquityStore>;
};

const LiquityContext = createContext<LiquityContextValue | undefined>(undefined);

type LiquityProviderProps = React.PropsWithChildren<{
  loader?: React.ReactNode;
  unsupportedNetworkFallback?: React.ReactNode;
  unsupportedMainnetFallback?: React.ReactNode;
}>;

export const LiquityProvider: React.FC<LiquityProviderProps> = ({
  children,
  loader,
  unsupportedNetworkFallback,
  unsupportedMainnetFallback
}) => {
  const chainId = useChainId();
  const client = useClient();

  const provider =
    client &&
    new Web3Provider(
      (method, params) =>
        client.request({
          method: method as any,
          params: params as any
        }),
      chainId
    );

  const account = useAccount();
  const walletClient = useWalletClient();

  const signer =
    account.address &&
    walletClient.data &&
    new Web3Provider(
      (method, params) =>
        walletClient.data.request({
          method: method as any,
          params: params as any
        }),
      chainId
    ).getSigner(account.address);

  const [config, setConfig] = useState<LiquityFrontendConfig>();

  const connection = useMemo(() => {
    if (config && provider && signer && account.address) {
      const batchedProvider = new BatchedProvider(provider, chainId);
      // batchedProvider._debugLog = true;

      try {
        return _connectByChainId(batchedProvider, signer, chainId, {
          userAddress: account.address,
          frontendTag: config.frontendTag,
          useStore: "blockPolled"
        });
      } catch (err) {
        console.error(err);
      }
    }
  }, [config, provider, signer, account.address, chainId]);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config || !provider || !signer || !account.address) {
    return <>{loader}</>;
  }

  if (config.testnetOnly && chainId === 1) {
    return <>{unsupportedMainnetFallback}</>;
  }

  if (!connection) {
    return <>{unsupportedNetworkFallback}</>;
  }

  const liquity = EthersLiquity._from(connection);
  liquity.store.logging = true;

  return (
    <LiquityContext.Provider
      value={{ config, account: account.address, provider: connection.provider, liquity }}
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
