import { useEffect } from "react";

import { Decimal, Trove, LUSD_MINIMUM_DEBT } from "@liquity/lib-base";

import { useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { useMyTransactionState } from "../../Transaction";

import { TroveDeposit, TroveWithdraw } from "../TroveEditor";
import TroveAction from "../TroveAction";
import useTroveView from "../context/TroveViewContext";
import Button from "../../Button";

import {
  selectForTroveChangeValidation,
  validateTroveChange
} from "../validation/validateTroveChange";

import classes from "./TroveManager.module.css";

const init = ({ trove }) => ({
  original: trove,
  edited: new Trove(trove.collateral, trove.debt),
  changePending: false,
  debtDirty: false,
  addedMinimumDebt: false
});

const reduceWith = action => state => reduce(state, action);

const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state, action) => {
  const { original, edited, changePending, debtDirty, addedMinimumDebt } = state;

  switch (action.type) {
    case "startChange": {
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setCollateral": {
      const newCollateral = action.newValue
        ? Decimal.from(action.newValue).add(state.original.collateral)
        : original.collateral;

      const newState = {
        ...state,
        edited: edited.setCollateral(newCollateral)
      };

      if (!debtDirty) {
        if (edited.isEmpty && newCollateral.nonZero) {
          return addMinimumDebt(newState);
        }
        if (addedMinimumDebt && newCollateral.isZero) {
          return removeMinimumDebt(newState);
        }
      }

      return newState;
    }

    case "substractCollateral": {
      const newCollateral = action.newValue
        ? original.collateral.lt(Decimal.from(action.newValue))
          ? Decimal.ZERO
          : original.collateral.sub(Decimal.from(action.newValue))
        : original.collateral;

      const newState = {
        ...state,
        edited: edited.setCollateral(newCollateral)
      };

      return newState;
    }

    case "setDebt": {
      const newDebt = action.newValue
        ? Decimal.from(action.newValue).add(state.original.debt)
        : original.debt;

      return {
        ...state,
        edited: edited.setDebt(newDebt.add(action.fee)),
        debtDirty: true
      };
    }

    case "substractDebt": {
      const newDebt = action.newValue
        ? original.debt.lt(Decimal.from(action.newValue))
          ? Decimal.ZERO
          : original.debt.sub(Decimal.from(action.newValue))
        : original.debt;

      return {
        ...state,
        edited: edited.setDebt(newDebt),
        debtDirty: true
      };
    }

    case "addMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(LUSD_MINIMUM_DEBT),
        addedMinimumDebt: true
      };

    case "removeMinimumDebt":
      return {
        ...state,
        edited: edited.setDebt(0),
        addedMinimumDebt: false
      };

    case "revert":
      return {
        ...state,
        edited: new Trove(original.collateral, original.debt),
        debtDirty: false,
        addedMinimumDebt: false
      };

    case "updateStore": {
      const {
        newState: { trove },
        stateChange: { troveBeforeRedistribution: changeCommitted }
      } = action;

      const newState = {
        ...state,
        original: trove
      };

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      const change = original.whatChanged(edited, 0);

      if (
        (change?.type === "creation" && !trove.isEmpty) ||
        (change?.type === "closure" && trove.isEmpty)
      ) {
        return revert(newState);
      }

      return { ...newState, edited: trove.apply(change, 0) };
    }

    default:
      return state;
  }
};

const feeFrom = (original, edited, borrowingRate) => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowLUSD) {
    return change.params.borrowLUSD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

const select = state => ({
  fees: state.fees,
  validationContext: selectForTroveChangeValidation(state)
});

const transactionIdPrefix = "trove-";
const transactionIdMatcher = new RegExp(`^${transactionIdPrefix}`);

const TroveManager = ({ collateral, debt, activeTab }) => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees, validationContext } = useLiquitySelector(select);

  useEffect(() => {
    if (collateral !== undefined) {
      dispatch({ type: "setCollateral", newValue: collateral });
    }
    if (debt !== undefined) {
      dispatch({ type: "setDebt", newValue: debt });
    }
  }, [collateral, debt, dispatch]);

  const borrowingRate = fees.borrowingRate();
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  const [validChange, description] = validateTroveChange(
    original,
    edited,
    borrowingRate,
    validationContext
  );

  const { dispatchEvent } = useTroveView();

  const myTransactionState = useMyTransactionState(transactionIdMatcher);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      if (myTransactionState.id === `${transactionIdPrefix}closure`) {
        dispatchEvent("TROVE_CLOSED");
      } else {
        dispatchEvent("TROVE_ADJUSTED");
      }
    }
  }, [myTransactionState, dispatch, dispatchEvent]);

  const TroveComponent = activeTab === "deposit" ? TroveDeposit : TroveWithdraw;

  return (
    <TroveComponent
      original={original}
      edited={edited}
      fee={feeFrom(original, edited, borrowingRate)}
      borrowingRate={borrowingRate}
      changePending={changePending}
      dispatch={dispatch}
    >
      <div className={classes.container}>
        {description}

        {validChange ? (
          <TroveAction
            transactionId={`${transactionIdPrefix}${validChange.type}`}
            change={validChange}
            maxBorrowingRate={maxBorrowingRate}
            className={classes.action}
            large
            primary
          >
            Confirm
          </TroveAction>
        ) : (
          <Button large primary disabled uppercase className={classes.action}>
            Confirm
          </Button>
        )}
      </div>
    </TroveComponent>
  );
};

export default TroveManager;
