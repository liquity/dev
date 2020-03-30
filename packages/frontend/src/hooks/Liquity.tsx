import React, { createContext, useContext, useCallback } from "react";
import { Interface } from "ethers/utils";
import { Web3Provider } from "ethers/providers";
import { useWeb3React } from "@web3-react/core";

import {
  Liquity,
  Trove,
  StabilityDeposit,
  addressesOnNetwork,
  connectToContracts,
  contractsToInterfaces
} from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { useAsyncValue, useAsyncStore } from "./AsyncValue";
import { useAccountBalance } from "./AccountBalance";

export const deployerAddress = "0x70E78E2D8B2a4fDb073B7F61c4653c23aE12DDDF";

type LiquityContext = {
  account: string;
  provider: Web3Provider;
  interfaces: { [address: string]: [string, Interface] };
  liquity: Liquity;
};

const LiquityContext = createContext<LiquityContext | undefined>(undefined);

type LiquityProviderProps = {
  loader?: React.ReactNode;
};

export const LiquityProvider: React.FC<LiquityProviderProps> = ({ children, loader }) => {
  const { library: provider, account, chainId } = useWeb3React<Web3Provider>();

  if (!provider || !account || !chainId) {
    return <>{loader}</>;
  }

  const addresses = addressesOnNetwork[chainId];
  const contracts = connectToContracts(addresses, provider.getSigner(account));
  const interfaces = contractsToInterfaces(contracts);
  const liquity = new Liquity(contracts, account);

  return (
    <LiquityContext.Provider value={{ account, provider, interfaces, liquity }}>
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

export const useLiquityStore = (provider: Web3Provider, account: string, liquity: Liquity) => {
  const getNumberOfTroves = useCallback(() => liquity.getNumberOfTroves(), [liquity]);
  const getPool = useCallback(() => liquity.getPool(), [liquity]);

  const getPrice = useCallback(() => liquity.getPrice(), [liquity]);
  const watchPrice = useCallback(
    (onPriceChanged: (price: Decimal) => void) => {
      const logged = (price: Decimal) => {
        console.log(`Update price to ${price}`);
        onPriceChanged(price);
      };
      return liquity.watchPrice(logged);
    },
    [liquity]
  );

  const getTrove = useCallback(() => liquity.getTrove(), [liquity]);
  const watchTrove = useCallback(
    (onTroveChanged: (trove: Trove) => void) => {
      const logged = (trove: Trove) => {
        console.log("Update trove to:");
        console.log(`{ collateral: ${trove.collateral},`);
        console.log(`  debt: ${trove.debt},`);
        console.log(`  pendingCollateralReward: ${trove.pendingCollateralReward},`);
        console.log(`  pendingDebtReward: ${trove.pendingDebtReward} }`);
        onTroveChanged(trove);
      };
      return liquity.watchTrove(logged);
    },
    [liquity]
  );

  const getStabilityDeposit = useCallback(() => liquity.getStabilityDeposit(), [liquity]);
  const watchStabilityDeposit = useCallback(
    (onStabilityDepositChanged: (deposit: StabilityDeposit) => void) => {
      const logged = (deposit: StabilityDeposit) => {
        console.log("Update deposit to:");
        console.log(`{ deposit: ${deposit.deposit},`);
        console.log(`  pendingDepositLoss: ${deposit.pendingDepositLoss},`);
        console.log(`  pendingCollateralGain: ${deposit.pendingCollateralGain} }`);
        onStabilityDepositChanged(deposit);
      };
      return liquity.watchStabilityDeposit(logged);
    },
    [liquity]
  );

  const getQuiBalance = useCallback(() => liquity.getQuiBalance(), [liquity]);
  const watchQuiBalance = useCallback(
    (onQuiBalanceChanged: (balance: Decimal) => void) => {
      const logged = (balance: Decimal) => {
        console.log(`Update quiBalance to ${balance}`);
        onQuiBalanceChanged(balance);
      };
      return liquity.watchQuiBalance(logged);
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
