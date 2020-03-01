import React, { useMemo, createContext, useContext, useCallback } from "react";
import { Web3Provider } from "ethers/providers";
import { useWeb3React } from "@web3-react/core";

import { Liquity, LiquityContractAddresses, Trove } from "@liquity/lib";
import { useAsyncValue } from "../hooks/AsyncValue";

const contractAddresses: LiquityContractAddresses = {
  activePool: "0x04700bCA4766f391fC55A4E36da0Be83daA849F6",
  cdpManager: "0xf9f6344919048Da7b8874780e575E087fEA009e5",
  clvToken: "0x277A693784789582F4A154a3Eb8fd827e99B5A88",
  defaultPool: "0xF686A081b216F818431267339B4e78E03D8282CC",
  nameRegistry: "0x289824E4291f8c2Ab27dC1dFDFc189401B06680a",
  poolManager: "0x581Ad97A398Ef2377a7d0c8A51Afc39Bc833Af7D",
  priceFeed: "0x3cd61B9D6e94F2fF4D51295EA9D2D581432adA01",
  sortedCDPs: "0x9F23490eF9A5F63546Dab89f3a6dED0Bf8467331",
  stabilityPool: "0xCb05a079C0EbC818961866EC38B7c05827Cfc96b"
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
