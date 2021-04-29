import { createContext, useContext } from "react";

export const StabilityViewContext = createContext(null);

export const useStabilityView = () => {
  const context = useContext(StabilityViewContext);

  if (context === null) {
    throw new Error("You must add a <StabilityViewProvider> into the React tree");
  }

  return context;
};
