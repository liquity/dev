import { useEffect } from "react";

import { useLiquityReducer } from "@liquity/lib-react";

import { useMyTransactionState } from "../../Transaction";

import { StakingViewContext } from "./StakingViewContext";

const init = ({ lqtyStake }) => ({
  lqtyStake,
  changePending: false,
  adjusting: false
});

const reduce = (state, action) => {
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

      return state;
    }
    default:
      return state;
  }
};

export const StakingViewProvider = ({ children }) => {
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
