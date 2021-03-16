import React, { useCallback } from "react";

import { Decimal, Decimalish, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer } from "@liquity/lib-react";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { StabilityDepositAction } from "./StabilityDepositAction";
import { Flex } from "@theme-ui/components";
import { Button } from "theme-ui";
import { useStabilityView } from "./context/StabilityViewContext";
import { StabilityActionDescription } from "./StabilityActionDescription";

const init = ({ stabilityDeposit }: LiquityStoreState) => ({
  originalDeposit: stabilityDeposit,
  editedLUSD: stabilityDeposit.currentLUSD,
  changePending: false
});

type StabilityDepositManagerState = ReturnType<typeof init>;
type StabilityDepositManagerAction =
  | LiquityStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" }
  | { type: "setDeposit"; newValue: Decimalish };

const reduceWith = (action: StabilityDepositManagerAction) => (
  state: StabilityDepositManagerState
): StabilityDepositManagerState => reduce(state, action);

const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (
  state: StabilityDepositManagerState,
  action: StabilityDepositManagerAction
): StabilityDepositManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalDeposit, editedLUSD, changePending } = state;

  switch (action.type) {
    case "startChange": {
      console.log("changeStarted");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setDeposit":
      return { ...state, editedLUSD: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedLUSD: originalDeposit.currentLUSD };

    case "updateStore": {
      const {
        stateChange: { stabilityDeposit: updatedDeposit }
      } = action;

      if (!updatedDeposit) {
        return state;
      }

      const newState = { ...state, originalDeposit: updatedDeposit };

      const changeCommitted =
        !updatedDeposit.initialLUSD.eq(originalDeposit.initialLUSD) ||
        updatedDeposit.currentLUSD.gt(originalDeposit.currentLUSD) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain) ||
        updatedDeposit.lqtyReward.lt(originalDeposit.lqtyReward);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedLUSD: updatedDeposit.apply(originalDeposit.whatChanged(editedLUSD))
      };
    }
  }
};

export const StabilityDepositManager: React.FC = () => {
  const [{ originalDeposit, editedLUSD, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { dispatchEvent } = useStabilityView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  return (
    <StabilityDepositEditor
      originalDeposit={originalDeposit}
      editedLUSD={editedLUSD}
      changePending={changePending}
      dispatch={dispatch}
    >
      <StabilityActionDescription
        originalDeposit={originalDeposit}
        editedLUSD={editedLUSD}
        changePending={changePending}
      />
      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        <StabilityDepositAction
          originalDeposit={originalDeposit}
          editedLUSD={editedLUSD}
          changePending={changePending}
          dispatch={dispatch}
        />
      </Flex>
    </StabilityDepositEditor>
  );
};
