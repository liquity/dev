import React, { useState, useEffect, useContext, createContext } from "react";
import { useLiquity } from "../../../hooks/LiquityContext";

export type Addresses = {
  BLUSD_AMM_ADDRESS: string | null;
  BLUSD_AMM_STAKING_ADDRESS: string | null;
  BLUSD_TOKEN_ADDRESS: string | null;
  BOND_NFT_ADDRESS: string | null;
  CHICKEN_BOND_MANAGER_ADDRESS: string | null;
  LUSD_OVERRIDE_ADDRESS: string | null;
};

export const chainIdNetworkMap: Record<number, string> = {
  1: "mainnet",
  5: "goerli",
  11155111: "sepolia"
};

export const BondAdddressesContext = createContext<Addresses | undefined>(undefined);

export const useBondAddresses = (): Addresses => {
  const context = useContext(BondAdddressesContext);

  if (context === undefined) {
    throw new Error("You must add a <BondAddressesProvider> into the React tree");
  }

  return context;
};

type BondAddressesProviderProps = {
  loader?: React.ReactNode;
};

export const BondAddressesProvider: React.FC<BondAddressesProviderProps> = ({
  loader,
  children
}) => {
  const { liquity } = useLiquity();
  const [addresses, setAddresses] = useState<Addresses | undefined>();
  const [failedToGetAddresses, setFailedToGetAddresses] = useState(false);

  useEffect(() => {
    (async () => {
      if (liquity.connection.signer === undefined) return;
      const chainId = await liquity.connection.signer.getChainId();
      const network = chainIdNetworkMap[chainId];

      try {
        const { default: addresses } = (await import(
          `@liquity/chicken-bonds/lusd/addresses/${network}.json`
        )) as { default: Addresses };

        setAddresses(addresses);
      } catch (e: unknown) {
        setAddresses({
          BLUSD_AMM_ADDRESS: null,
          BLUSD_AMM_STAKING_ADDRESS: null,
          BLUSD_TOKEN_ADDRESS: null,
          BOND_NFT_ADDRESS: null,
          CHICKEN_BOND_MANAGER_ADDRESS: null,
          LUSD_OVERRIDE_ADDRESS: null
        });
        setFailedToGetAddresses(true);
        console.error(`Failed to import ${network} bond addresses: ${e}`);
      }
    })();
  }, [liquity.connection.signer]);

  return (
    <BondAdddressesContext.Provider value={addresses}>
      {!failedToGetAddresses && addresses === undefined && loader}
      {addresses !== undefined && children}
    </BondAdddressesContext.Provider>
  );
};
