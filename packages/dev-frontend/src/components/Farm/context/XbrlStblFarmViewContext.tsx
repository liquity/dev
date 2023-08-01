import { createContext, useContext } from "react";
import type { FarmView, FarmEvent } from "./transitions";

type XbrlStblFarmViewContextType = {
  xbrlStblView: FarmView;
  dispatchEvent: (event: FarmEvent) => void;
};

export const XbrlStblFarmViewContext = createContext<XbrlStblFarmViewContextType | null>(null);

export const useXbrlStblFarmView = (): XbrlStblFarmViewContextType => {
  const context: XbrlStblFarmViewContextType | null = useContext(XbrlStblFarmViewContext);

  if (context === null) {
    throw new Error("You must add a <FarmViewProvider> into the React tree");
  }

  return context;
};
