import { BondAddressesProvider } from "./BondAddressesContext";
import { BondViewProvider } from "./BondViewProvider";

type BondsProviderProps = {
  loader?: React.ReactNode;
};

export const BondsProvider: React.FC<BondsProviderProps> = ({ children, loader }) => {
  return (
    <BondAddressesProvider loader={loader}>
      <BondViewProvider>{children}</BondViewProvider>
    </BondAddressesProvider>
  );
};
