import { createContext, useContext } from "react";

export type StakingView = "ACTIVE" | "ADJUSTING" | "NONE";

export type StakingViewAction = { type: "startAdjusting" | "cancelAdjusting" };

export type StakingViewContextType = {
  view: StakingView;

  // Indicates that a staking TX is pending.
  // The panel should be covered with a spinner overlay when this is true.
  changePending: boolean;

  // Dispatch an action that changes the Staking panel's view.
  dispatch: (action: StakingViewAction) => void;
};

export const StakingViewContext = createContext<StakingViewContextType | null>(null);

export const useStakingView = (): StakingViewContextType => {
  const context = useContext(StakingViewContext);

  if (context === null) {
    throw new Error("You must add a <TroveViewProvider> into the React tree");
  }

  return context;
};
