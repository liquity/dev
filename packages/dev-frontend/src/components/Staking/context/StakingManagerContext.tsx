import { createContext, useContext } from "react";
import { Decimal, Decimalish, LQTYStake } from "@liquity/lib-base";

export type StakingManagerState = { originalStake: LQTYStake; editedLQTY: Decimal };
export type StakingManagerAction = { type: "revert" } | { type: "setStake"; newValue: Decimalish };

export type StakingManagerContextType = {
  state: StakingManagerState;
  dispatch: (action: StakingManagerAction) => void;
};

export const StakingManagerContext = createContext<StakingManagerContextType | null>(null);

export const useStakingManager = (): StakingManagerContextType => {
  const context = useContext(StakingManagerContext);

  if (context === null) {
    throw new Error("You must add a <StakingManagerProvider> into the React tree");
  }

  return context;
};
