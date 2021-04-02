import { useEffect } from "react";

import { LiquityStoreState, LQTYStake } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer } from "@liquity/lib-react";

import { useMyTransactionState } from "../../Transaction";

import { StakingViewAction, StakingViewContext } from "./StakingViewContext";

type StakingViewProviderAction =
  | LiquityStoreUpdate
  | StakingViewAction
  | { type: "startChange" | "abortChange" };

type StakingViewProviderState = {
  lqtyStake: LQTYStake;
  changePending: boolean;
  adjusting: boolean;
};

const init = ({ lqtyStake }: LiquityStoreState): StakingViewProviderState => ({
  lqtyStake,
  changePending: false,
  adjusting: false
});

const reduce = (
  state: StakingViewProviderState,
  action: StakingViewProviderAction
): StakingViewProviderState => {
  // console.log(state);
  // console.log(action);

  switch (action.type) {
    case "startAdjusting":
      return { ...state, adjusting: true };

    case "cancelAdjusting":
      return { ...state, adjusting: false };

    case "startChange":
      return { ...state, changePending: true };

    case "abortChange":
      return { ...state, changePending: false };

    case "updateStore": {
      const {
        oldState: { lqtyStake: oldStake },
        stateChange: { lqtyStake: updatedStake }
      } = action;

      if (updatedStake) {
        const changeCommitted =
          !updatedStake.stakedLQTY.eq(oldStake.stakedLQTY) ||
          updatedStake.collateralGain.lt(oldStake.collateralGain) ||
          updatedStake.lusdGain.lt(oldStake.lusdGain);

        return {
          ...state,
          lqtyStake: updatedStake,
          adjusting: false,
          changePending: changeCommitted ? false : state.changePending
        };
      }
    }
  }

  return state;
};

export const StakingViewProvider: React.FC = ({ children }) => {
  const stakingTransactionState = useMyTransactionState("stake");
  const [{ adjusting, changePending, lqtyStake }, dispatch] = useLiquityReducer(reduce, init);

  useEffect(() => {
    if (
      stakingTransactionState.type === "waitingForApproval" ||
      stakingTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (
      stakingTransactionState.type === "failed" ||
      stakingTransactionState.type === "cancelled"
    ) {
      dispatch({ type: "abortChange" });
    }
  }, [stakingTransactionState.type, dispatch]);

  return (
    <StakingViewContext.Provider
      value={{
        view: adjusting ? "ADJUSTING" : lqtyStake.isEmpty ? "NONE" : "ACTIVE",
        changePending,
        dispatch
      }}
    >
      {children}
    </StakingViewContext.Provider>
  );
};
