import { Web3Provider } from "ethers/providers";
import React, { useMemo, createContext, useContext, useState, useEffect, useCallback } from "react";

import { Liquity, LiquityContractAddresses, Trove } from "@liquity/lib";
import { useWeb3React } from "@web3-react/core";

const contractAddresses: LiquityContractAddresses = {
  activePool: "0xD0D48d6F2FCc589aB3Eba1081fBe63bC84786482",
  cdpManager: "0x53a46cd759E28Bda4156c0988E2Ad8DEE495EDD1",
  clvToken: "0x50d40f704D16e61E41ae440808099e71979fAcE1",
  defaultPool: "0xDE7aAdEBB5e0f764ce45BF190f579D162B5515a0",
  nameRegistry: "0xAa0F16A52f26d236a3b13FbD08aF922AD8269312",
  poolManager: "0xdd5A2140E0773Dcf427a2CFe944bE9Cd6333bCD2",
  priceFeed: "0x1Ec7952E309DbF4F1188fc0a252710122Eb2254F",
  sortedCDPs: "0xD71FCD0B412334480E5Ee0398DCc21d2A1613E8F",
  stabilityPool: "0x4D39e02Fc9f642Fb517B347aAC3273c85182e303"
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

export type LiquityCallState<T> = { type: "loading" } | { type: "loaded"; value: T } | undefined;

export function useLiquityCall<T>(
  getValue: (liquity: Liquity) => Promise<T>,
  watchValue?: (liquity: Liquity, onValueChanged: (value: T) => void) => () => void
) {
  const liquity = useLiquity();
  const [callState, setCallState] = useState<LiquityCallState<T>>();

  useEffect(() => {
    if (liquity) {
      const fetchValue = async () => {
        setCallState({ type: "loaded", value: await getValue(liquity) });
      };

      const onValueChanged = (value: T) => {
        setCallState({ type: "loaded", value });
      };

      setCallState({ type: "loading" });
      fetchValue();
      if (watchValue) {
        return watchValue(liquity, onValueChanged);
      }
    } else {
      setCallState(undefined);
    }
  }, [liquity, getValue, watchValue]);

  return callState;
}

export const useTroveState = () => {
  const memoizedGetTrove = useCallback((liquity: Liquity) => liquity.getTrove(), []);
  const memoizedWatchTrove = useCallback(
    (liquity: Liquity, onTroveChanged: (trove: Trove | undefined) => void) => {
      return liquity.watchTrove(onTroveChanged);
    },
    []
  );
  const troveState = useLiquityCall(memoizedGetTrove, memoizedWatchTrove);

  return troveState;
};
