import { createContext, useContext } from "react";
import type { StabilityView, StabilityEvent } from "./types";

type StabilityViewContextType = {
  view: StabilityView;
  dispatchEvent: (event: StabilityEvent) => void;
};

export const StabilityViewContext = createContext<StabilityViewContextType | null>(null);

export const useStabilityView = (): StabilityViewContextType => {
  const context: StabilityViewContextType | null = useContext(StabilityViewContext);

  if (context === null) {
    throw new Error("You must add a <StabilityViewProvider> into the React tree");
  }

  return context;
};
