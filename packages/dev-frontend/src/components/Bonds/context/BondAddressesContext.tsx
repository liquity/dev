import { useWeb3React } from "@web3-react/core";
import React, { useContext, createContext } from "react";

import mainnet from "@liquity/chicken-bonds/lusd/addresses/mainnet.json";
import goerli from "@liquity/chicken-bonds/lusd/addresses/goerli.json";

export type Addresses = {
  BLUSD_AMM_ADDRESS: string | null;
  BLUSD_AMM_STAKING_ADDRESS: string | null;
  BLUSD_TOKEN_ADDRESS: string | null;
  BOND_NFT_ADDRESS: string | null;
  CHICKEN_BOND_MANAGER_ADDRESS: string | null;
  LUSD_OVERRIDE_ADDRESS: string | null;
};

const nullAddresses: Addresses = {
  BLUSD_AMM_ADDRESS: null,
  BLUSD_AMM_STAKING_ADDRESS: null,
  BLUSD_TOKEN_ADDRESS: null,
  BOND_NFT_ADDRESS: null,
  CHICKEN_BOND_MANAGER_ADDRESS: null,
  LUSD_OVERRIDE_ADDRESS: null
};

export const chainIdAddressesMap: Partial<Record<number, Addresses>> = {
  1: mainnet,
  5: goerli
  // 11155111: sepolia
};

export const BondAddressesContext = createContext<Addresses | undefined>(undefined);

export const useBondAddresses = (): Addresses => {
  const context = useContext(BondAddressesContext);

  if (context === undefined) {
    throw new Error("You must add a <BondAddressesProvider> into the React tree");
  }

  return context;
};

export const BondAddressesProvider: React.FC = ({ children }) => {
  const { chainId } = useWeb3React();

  const addresses: Addresses =
    chainId !== undefined ? chainIdAddressesMap[chainId] ?? nullAddresses : nullAddresses;

  return <BondAddressesContext.Provider value={addresses}>{children}</BondAddressesContext.Provider>;
};
