import { BondAddressesProvider } from "./BondAddressesContext";
import { BondViewProvider } from "./BondViewProvider";

export const BondsProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <BondAddressesProvider>
      <BondViewProvider>{children}</BondViewProvider>
    </BondAddressesProvider>
  );
};
