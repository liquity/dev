import React, { useCallback } from "react";

import { LUSD_LIQUIDATION_RESERVE, LiquityStoreState, Decimal, Decimalish } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";
import { Flex, Button } from "theme-ui";
import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";

const init = ({ trove }: LiquityStoreState) => ({
  original: trove,
  edited: trove,
  changePending: false,
  debtDirty: false,
  addedGasCompensation: false
});

type TroveManagerState = ReturnType<typeof init>;
type TroveManagerAction =
  | LiquityStoreUpdate
  | {
      type:
        | "startChange"
        | "finishChange"
        | "revert"
        | "addDebtCompensation"
        | "removeDebtCompensation";
    }
  | { type: "setCollateral" | "setDebt"; newValue: Decimalish };

const reduceWith = (action: TroveManagerAction) => (state: TroveManagerState): TroveManagerState =>
  reduce(state, action);

const addDebtCompensation = reduceWith({ type: "addDebtCompensation" });
const removeDebtCompensation = reduceWith({ type: "removeDebtCompensation" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: TroveManagerState, action: TroveManagerAction): TroveManagerState => {
  // console.log(state);
  // console.log(action);

  const { original, edited, changePending, debtDirty, addedGasCompensation } = state;

  switch (action.type) {
    case "startChange": {
      console.log("starting change");
      return { ...state, changePending: true };
    }

    case "finishChange":
      return { ...state, changePending: false };

    case "setCollateral": {
      const newCollateral = Decimal.from(action.newValue);

      const newState = {
        ...state,
        edited: edited.setCollateral(newCollateral)
      };

      if (!debtDirty) {
        if (edited.isEmpty && newCollateral.nonZero) {
          return addDebtCompensation(newState);
        }
        if (addedGasCompensation && newCollateral.isZero) {
          return removeDebtCompensation(newState);
        }
      }

      return newState;
    }

    case "setDebt":
      return {
        ...state,
        edited: edited.setDebt(action.newValue),
        debtDirty: true
      };

    case "addDebtCompensation":
      return {
        ...state,
        edited: edited.setDebt(LUSD_LIQUIDATION_RESERVE),
        addedGasCompensation: true
      };

    case "removeDebtCompensation":
      return {
        ...state,
        edited: edited.setDebt(0),
        addedGasCompensation: false
      };

    case "revert":
      return {
        ...state,
        edited: original,
        debtDirty: false,
        addedGasCompensation: false
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
  }
};

const select = ({ fees }: LiquityStoreState) => ({
  fees
});

export const TroveManager: React.FC = () => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees } = useLiquitySelector(select);

  const change = original.whatChanged(edited, 0);
  const borrowingRate = fees.borrowingRate();
  const afterFee = original.apply(change, borrowingRate);
  console.log({ original, change });
  const { recordEvent } = useTroveView();

  const handleCancel = useCallback(() => {
    recordEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, []);

  return (
    <TroveEditor
      original={original}
      edited={edited}
      afterFee={afterFee}
      borrowingRate={borrowingRate}
      change={change}
      changePending={changePending}
      dispatch={dispatch}
    >
      <Flex variant="layout.actions">
        <Flex>
          <Button variant="cancel" onClick={handleCancel}>
            Cancel
          </Button>
        </Flex>
        <TroveAction
          original={original}
          edited={edited}
          afterFee={afterFee}
          change={change}
          changePending={changePending}
          dispatch={dispatch}
        />
      </Flex>
    </TroveEditor>
  );
};
