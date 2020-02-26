import { Web3Provider } from "ethers/providers";
import React, { useMemo, createContext, useContext, useState, useEffect, useCallback } from "react";

import { Liquity, LiquityContractAddresses } from "@liquity/lib";
import { useWeb3React } from "@web3-react/core";

const contractAddresses: LiquityContractAddresses = {
  activePool: "0xd28fe5d691eE793e47685e3D2844Ba432C5BBB19",
  cdpManager: "0x051b5Bd5314FC29038ac66F76798fD6110f2186c",
  clvToken: "0x134a8b33fD3f4ad5F211FAe5616a0acAEEEE08Ba",
  defaultPool: "0x6838a92608AB7Cfa9c4d88217491F22e7EEbc0b6",
  nameRegistry: "0xE98801a095c21d52122872a97dc64799767C9CE4",
  poolManager: "0xB15ddD7c87C6f14f039543B2c3028679eD00D5A0",
  priceFeed: "0xF17B6F58F256e635d2bF9CCB8AFBAFfde34c32A0",
  sortedCDPs: "0xD26F83A5cc323D40fA7E884bD51fA71c6d973317",
  stabilityPool: "0xA330C37aA989dc542A4D3E9d9E0e0F81daDac1e0"
};

const LiquityContext = createContext<Liquity | undefined>(undefined);

export const LiquityProvider: React.FC = ({ children }) => {
  const { account, library } = useWeb3React<Web3Provider>();

  const liquity = useMemo<Liquity | undefined>(() => {
    if (library) {
      if (account) {
        return Liquity.connect(contractAddresses, library.getSigner(account));
      } else {
        return Liquity.connect(contractAddresses, library);
      }
    }
  }, [account, library]);

  return React.createElement(LiquityContext.Provider, { value: liquity }, children);
};

export const useLiquity = () => useContext(LiquityContext);

export type LiquityCallState<T> = { type: "loading" } | { type: "loaded"; result: T } | undefined;

export const useLiquityCall = <T>(
  callFunc: (liquity: Liquity) => Promise<T>
): LiquityCallState<T> => {
  const liquity = useLiquity();
  const [callState, setCallState] = useState<LiquityCallState<T>>();

  useEffect(() => {
    if (liquity) {
      const dispatchCall = async () => {
        setCallState({ type: "loading" });
        setCallState({ type: "loaded", result: await callFunc(liquity) });
      };
      dispatchCall();
    } else {
      setCallState(undefined);
    }
  }, [liquity, callFunc]);

  return callState;
};

export const useTroveState = () => {
  const memoizedGetTrove = useCallback((liquity: Liquity) => liquity.getTrove(), []);
  return useLiquityCall(memoizedGetTrove);
};
