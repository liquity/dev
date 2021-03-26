import { createContext, useContext } from "react";
import type { FarmView, FarmEvent } from "./transitions";

type FarmViewContextType = {
  view: FarmView;
  dispatchEvent: (event: FarmEvent) => void;
};

export const FarmViewContext = createContext<FarmViewContextType | null>(null);

export const useFarmView = (): FarmViewContextType => {
  const context: FarmViewContextType | null = useContext(FarmViewContext);

  if (context === null) {
    throw new Error("You must add a <FarmViewProvider> into the React tree");
  }

  return context;
};
