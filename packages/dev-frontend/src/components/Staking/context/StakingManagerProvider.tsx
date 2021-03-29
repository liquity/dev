import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer } from "@liquity/lib-react";

import {
  StakingManagerAction,
  StakingManagerContext,
  StakingManagerState
} from "./StakingManagerContext";

const init = ({ lqtyStake }: LiquityStoreState): StakingManagerState => ({
  originalStake: lqtyStake,
  editedLQTY: lqtyStake.stakedLQTY
});

const reduce = (
  state: StakingManagerState,
  action: LiquityStoreUpdate | StakingManagerAction
): StakingManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedLQTY } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedLQTY: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedLQTY: originalStake.stakedLQTY };

    case "updateStore": {
      const {
        stateChange: { lqtyStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedLQTY: updatedStake.apply(originalStake.whatChanged(editedLQTY))
        };
      }
    }
  }

  return state;
};

export const StakingManagerProvider: React.FC = ({ children }) => {
  const [state, dispatch] = useLiquityReducer(reduce, init);

  return (
    <StakingManagerContext.Provider value={{ state, dispatch }}>
      {children}
    </StakingManagerContext.Provider>
  );
};
