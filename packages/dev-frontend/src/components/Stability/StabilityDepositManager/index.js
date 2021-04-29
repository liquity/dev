import { useCallback, useEffect, useState } from "react";

import { Decimal } from "@liquity/lib-base";
import { useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../../strings";

import { useMyTransactionState } from "../../Transaction";

import { StabilityDepositEditor } from "../StabilityDepositEditor";
import { StabilityDepositAction } from "../StabilityDepositAction";
import { useStabilityView } from "../context/StabilityViewContext";
import {
  selectForStabilityDepositChangeValidation,
  validateStabilityDepositChange
} from "../validation/validateStabilityDepositChange";
import Button from "../../Button";

import classes from "./StabilityDepositManager.module.css";

const init = ({ stabilityDeposit }) => ({
  originalDeposit: stabilityDeposit,
  editedLUSD: stabilityDeposit.currentLUSD,
  changePending: false
});

const reduceWith = action => state => reduce(state, action);

const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state, action) => {
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
    default:
      return state;
  }
};

const transactionId = "stability-deposit";

const Head = ({ total, title }) => {
  return (
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>total staked {total.div(1000).prettify(0)}k</p>
        <p className={classes.totalAPR}>APR 25%</p>
      </div>
      <h3 className={classes.title}>{title}</h3>
    </div>
  );
};

const StabilityDepositManager = () => {
  const [{ originalDeposit, editedLUSD, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const validationContext = useLiquitySelector(selectForStabilityDepositChangeValidation);
  const { dispatchEvent, view } = useStabilityView();
  const [modal, setModal] = useState(null);

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const [validChange, description] = validateStabilityDepositChange(
    originalDeposit,
    editedLUSD,
    validationContext
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
    <>
      <Head
        total={validationContext.lusdInStabilityPool}
        title={"Earn ETH and LQTY by depositing LUSD"}
      />
      <StabilityDepositEditor
        modal={modal}
        setModal={setModal}
        originalDeposit={originalDeposit}
        editedLUSD={editedLUSD}
        changePending={changePending}
        dispatch={dispatch}
        validChange={validChange}
        transactionId={transactionId}
        view={view}
      />
    </>
  );
};

export default StabilityDepositManager;

// <Button variant="cancel" onClick={handleCancel}>
// Cancel
// </Button>

// {validChange ? (
//   <StabilityDepositAction transactionId={transactionId} change={validChange}>
//     Confirm
//   </StabilityDepositAction>
// ) : (
//   <Button disabled>Confirm</Button>
// )}
