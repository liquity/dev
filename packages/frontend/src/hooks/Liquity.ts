import React, { useMemo, createContext, useContext, useCallback } from "react";
import { Web3Provider } from "ethers/providers";
import { useWeb3React } from "@web3-react/core";

import { Liquity, Trove } from "@liquity/lib";
import { useAsyncValue, useAsyncStore } from "../hooks/AsyncValue";
import { useAccountBalance } from "./AccountBalance";

export const deployerAddress = "0x00a329c0648769A73afAc7F9381E08FB43dBEA72";
const cdpManagerAddress = "0xf9f6344919048Da7b8874780e575E087fEA009e5";
//const cdpManagerAddress = "0xc44BbB41FddF601e5fC09263F91178049235097F";

type LiquityContext = {
  account: string;
  library: Web3Provider;
  liquity: Liquity;
};

const LiquityContext = createContext<LiquityContext | undefined>(undefined);

type LiquityProviderProps = {
  fallback: React.ReactNode;
};

export const LiquityProvider: React.FC<LiquityProviderProps> = ({ children, fallback }) => {
  const { account, library } = useWeb3React<Web3Provider>();

  const liquity = useMemo<Liquity | undefined>(() => {
    if (library && account) {
      return Liquity.connect(cdpManagerAddress, library, account);
    }
  }, [account, library]);

  if (account && library && liquity) {
    return React.createElement(
      LiquityContext.Provider,
      { value: { account, library, liquity } },
      children
    );
  } else {
    return React.createElement(React.Fragment, {}, fallback);
  }
};

export const useLiquity = () => {
  const liquityContext = useContext(LiquityContext);

  if (!liquityContext) {
    throw new Error("You must provide a LiquityContext via LiquityProvider");
  }

  return liquityContext;
};

export const useLiquityStore = (provider: Web3Provider, account: string, liquity: Liquity) => {
  const getPrice = useCallback(() => liquity.getPrice(), [liquity]);
  const getNumberOfTroves = useCallback(() => liquity.getNumberOfTroves(), [liquity]);
  const isRecoveryModeActive = useCallback(() => liquity.isRecoveryModeActive(), [liquity]);

  const getTrove = useCallback(() => liquity.getTrove(), [liquity]);
  const watchTrove = useCallback(
    (onTroveChanged: (trove: Trove | undefined) => void) => {
      return liquity.watchTrove(onTroveChanged);
    },
    [liquity]
  );

  return useAsyncStore({
    balance: useAccountBalance(provider, account),
    price: useAsyncValue(getPrice),
    recoveryModeActive: useAsyncValue(isRecoveryModeActive),
    numberOfTroves: useAsyncValue(getNumberOfTroves),
    trove: useAsyncValue(getTrove, watchTrove)
  });
};
