import React, { useMemo, createContext, useContext, useCallback } from "react";
import { Web3Provider } from "ethers/providers";
import { useWeb3React } from "@web3-react/core";

import { Liquity, LiquityContractAddresses, Trove } from "@liquity/lib";
import { useAsyncValue } from "../hooks/AsyncValue";

const contractAddresses: LiquityContractAddresses = {
  activePool: "0xdb3977ef1bb155dBaB365c43d68C0B60b8FA3561",
  cdpManager: "0x4333a9058f4Cb930B15b8C1610AE05329a1c0c42",
  clvToken: "0x0Ec3E397a02412921078072888BD92Ac89744Db9",
  defaultPool: "0xC89adD940b98844F7595f9D9EfBbB75c9B9962ea",
  nameRegistry: "0xDEb6C3f93683A477078f47f6a3d0cbb71eb932B7",
  poolManager: "0x591D995ed55D7b89A94adF245d902ECA95a049E4",
  priceFeed: "0xBC89a4a5F0006bf1d936d529719B9098862B1875",
  sortedCDPs: "0x7e20E483d1C6019862B732073982D0A9a7Fb7FBd",
  stabilityPool: "0x1dFa9Bc2460e708D97384aF4b8910602cF5CD54D"
};

const LiquityContext = createContext<Liquity | undefined>(undefined);

export const LiquityProvider: React.FC = ({ children }) => {
  const { account, library } = useWeb3React<Web3Provider>();

  const liquity = useMemo<Liquity | undefined>(() => {
    if (library) {
      return Liquity.connect(contractAddresses, library, account || undefined);
    }
  }, [account, library]);

  return React.createElement(LiquityContext.Provider, { value: liquity }, children);
};

export const useLiquity = () => useContext(LiquityContext);

/**
 * Hook for observing the Trove.
 *
 * Dispatches an async call to get the current Trove state. The state is then kept up-to-date via
 * contract events.
 *
 * @param liquity - The Liquity instance to get the Trove from.
 */
export const useTroveState = (liquity: Liquity) => {
  const getTrove = useCallback(() => liquity.getTrove(), [liquity]);

  const watchTrove = useCallback(
    (onTroveChanged: (trove: Trove | undefined) => void) => {
      return liquity.watchTrove(onTroveChanged);
    },
    [liquity]
  );

  return useAsyncValue(getTrove, watchTrove);
};
