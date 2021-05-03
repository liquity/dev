import { createContext, useContext } from "react";

export const StakingViewContext = createContext(null);

export const useStakingView = () => {
  const context = useContext(StakingViewContext);

  if (context === null) {
    throw new Error("You must add a <TroveViewProvider> into the React tree");
  }

  return context;
};
