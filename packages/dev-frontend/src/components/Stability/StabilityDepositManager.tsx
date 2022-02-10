import React, { useCallback, useEffect } from "react";
import { Button, Flex } from "theme-ui";

import { Decimal, Decimalish, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../strings";

import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { StabilityDepositAction } from "./StabilityDepositAction";
import { useStabilityView } from "./context/StabilityViewContext";
import {
  selectForStabilityDepositChangeValidation,
  validateStabilityDepositChange
} from "./validation/validateStabilityDepositChange";

const init = ({ stabilityDeposit }: LiquityStoreState) => ({
  originalDeposit: stabilityDeposit,
  editedUSD: stabilityDeposit.currentUSD,
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

  const { originalDeposit, editedUSD, changePending } = state;

  switch (action.type) {
    case "startChange": {
      console.log("changeStarted");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setDeposit":
      return { ...state, editedUSD: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedUSD: originalDeposit.currentUSD };

    case "updateStore": {
      const {
        stateChange: { stabilityDeposit: updatedDeposit }
      } = action;

      if (!updatedDeposit) {
        return state;
      }

      const newState = { ...state, originalDeposit: updatedDeposit };

      const changeCommitted =
        !updatedDeposit.bammPoolShare.eq(originalDeposit.bammPoolShare) ||
        updatedDeposit.poolShare.gt(originalDeposit.poolShare) ||
        updatedDeposit.currentUSD.lt(originalDeposit.currentUSD) ||
        updatedDeposit.initialLUSD.lt(originalDeposit.initialLUSD) ||
        updatedDeposit.currentLUSD.lt(originalDeposit.currentLUSD) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain) ||
        updatedDeposit.lqtyReward.lt(originalDeposit.lqtyReward) ||
        updatedDeposit.totalEthInBamm.lt(originalDeposit.totalEthInBamm) ||
        updatedDeposit.totalLusdInBamm.lt(originalDeposit.totalLusdInBamm);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedUSD: updatedDeposit.apply(originalDeposit.whatChanged(editedUSD))
      };
    }
  }
};

const transactionId = "stability-deposit";

export const StabilityDepositManager: React.FC = () => {
  const [{ originalDeposit, editedUSD, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const validationContext = useLiquitySelector(selectForStabilityDepositChangeValidation);
  const { dispatchEvent } = useStabilityView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);
  const [validChange] = validateStabilityDepositChange(
    originalDeposit,
    editedUSD,
    validationContext,
    undefined,
    undefined,
  );

  const makingNewDeposit = originalDeposit.isEmpty;

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("DEPOSIT_CONFIRMED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  return (
    <StabilityDepositEditor
      originalDeposit={originalDeposit}
      editedUSD={editedUSD}
      changePending={changePending}
      dispatch={dispatch}
    >


      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        {validChange ? (
          <StabilityDepositAction transactionId={transactionId} change={validChange}>
            Confirm
          </StabilityDepositAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </StabilityDepositEditor>
  );
};
