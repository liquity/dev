import React, { createContext, useContext, useCallback } from "react";
import { Web3Provider } from "ethers/providers";
import { useWeb3React } from "@web3-react/core";

import { Liquity, Trove, StabilityDeposit } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { useAsyncValue, useAsyncStore } from "../hooks/AsyncValue";
import { useAccountBalance } from "./AccountBalance";

export const deployerAddress = "0x70E78E2D8B2a4fDb073B7F61c4653c23aE12DDDF";

const cdpManagerAddressOnChain: { [chainId: number]: string } = {
  // ropsten
  3: "0x28c941d6A29b86036C18249C175CE2084f3983e7",

  // rinkeby
  4: "0x907CC782Eb562BDce0191be0ceC8Cace3F00E081",

  // goerli
  5: "0x710E14FBbaC14D819Be9a21E2089ebfdb8e3a95E",

  // kovan
  42: "0xecbc0A33CBf929DadD1D64B5E7A6247041402314",

  // parity dev chain
  17: "0x086063A27f505b8eA5a0E65F2A34B26197ef419C"
};

type LiquityContext = {
  account: string;
  library: Web3Provider;
  liquity: Liquity;
};

const LiquityContext = createContext<LiquityContext | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
};

export const LiquityProvider: React.FC<LiquityProviderProps> = ({ children, loader }) => {
  const { library, account, chainId } = useWeb3React<Web3Provider>();

  const liquityState = useAsyncValue(
    useCallback(async () => {
      if (library && account && chainId) {
        console.log(chainId);
        const cdpManagerAddress = cdpManagerAddressOnChain[chainId];
        return Liquity.connect(cdpManagerAddress, library, account);
      }
    }, [library, account, chainId])
  );

  if (!library || !account || !liquityState.loaded || !liquityState.value) {
    return React.createElement(React.Fragment, {}, loader);
  }

  const liquity = liquityState.value;

  return React.createElement(
    LiquityContext.Provider,
    { value: { account, library, liquity } },
    children
  );
};

export const useLiquity = () => {
  const liquityContext = useContext(LiquityContext);

  if (!liquityContext) {
    throw new Error("You must provide a LiquityContext via LiquityProvider");
  }

  return liquityContext;
};

export const useLiquityStore = (provider: Web3Provider, account: string, liquity: Liquity) => {
  const getNumberOfTroves = useCallback(() => liquity.getNumberOfTroves(), [liquity]);
  const getPool = useCallback(() => liquity.getPool(), [liquity]);

  const getPrice = useCallback(() => liquity.getPrice(), [liquity]);
  const watchPrice = useCallback(
    (onPriceChanged: (price: Decimal) => void) => {
      return liquity.watchPrice(onPriceChanged);
    },
    [liquity]
  );

  const getTrove = useCallback(() => liquity.getTrove(), [liquity]);
  const watchTrove = useCallback(
    (onTroveChanged: (trove: Trove | undefined) => void) => {
      return liquity.watchTrove(onTroveChanged);
    },
    [liquity]
  );

  const getStabilityDeposit = useCallback(() => liquity.getStabilityDeposit(), [liquity]);
  const watchStabilityDeposit = useCallback(
    (onStabilityDepositChanged: (deposit: StabilityDeposit) => void) => {
      return liquity.watchStabilityDeposit(onStabilityDepositChanged);
    },
    [liquity]
  );

  const getQuiBalance = useCallback(() => liquity.getQuiBalance(), [liquity]);
  const watchQuiBalance = useCallback(
    (onQuiBalanceChanged: (balance: Decimal) => void) => {
      return liquity.watchQuiBalance(onQuiBalanceChanged);
    },
    [liquity]
  );

  const getQuiInStabilityPool = useCallback(() => {
    return liquity.getQuiInStabilityPool();
  }, [liquity]);

  return useAsyncStore({
    etherBalance: useAccountBalance(provider, account),
    quiBalance: useAsyncValue(getQuiBalance, watchQuiBalance),
    price: useAsyncValue(getPrice, watchPrice),
    numberOfTroves: useAsyncValue(getNumberOfTroves),
    trove: useAsyncValue(getTrove, watchTrove),
    deposit: useAsyncValue(getStabilityDeposit, watchStabilityDeposit),
    pool: useAsyncValue(getPool),
    quiInStabilityPool: useAsyncValue(getQuiInStabilityPool)
  });
};
