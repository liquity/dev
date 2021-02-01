import React from "react";

import { Decimal, Decimalish } from "@liquity/decimal";
import { LUSD_LIQUIDATION_RESERVE, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { RedeemedTroveOverlay } from "./RedeemedTroveOverlay";
import { CollateralSurplusAction } from "./CollateralSurplusAction";

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
    case "startChange":
      return { ...state, changePending: true };

    case "finishChange":
      return { ...state, changePending: false };

    case "setCollateral": {
      const newCollateral = Decimal.from(action.newValue);

      const newState = { ...state, edited: edited.setCollateral(newCollateral) };

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
      return { ...state, edited: edited.setDebt(action.newValue), debtDirty: true };

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
      return { ...state, edited: original, debtDirty: false, addedGasCompensation: false };

    case "updateStore": {
      const {
        newState: { trove },
        stateChange: { troveWithoutRedistribution: changeCommitted }
      } = action;

      const newState = { ...state, original: trove };

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      const change = original.whatChanged(edited);

      if (
        (change?.type === "creation" && !trove.isEmpty) ||
        (change?.type === "closure" && trove.isEmpty)
      ) {
        return revert(newState);
      }

      return { ...newState, edited: trove.apply(change) };
    }
  }
};

const select = ({ fees, collateralSurplusBalance }: LiquityStoreState) => ({
  fees,
  redeemed: !collateralSurplusBalance.isZero
});

export const TroveManager: React.FC = () => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees, redeemed } = useLiquitySelector(select);

  const change = original.whatChanged(edited);
  const feeFactor = fees.borrowingFeeFactor();
  const afterFee = original.apply(change, feeFactor);

  return (
    <>
      <TroveEditor {...{ original, edited, afterFee, feeFactor, change, changePending, dispatch }}>
        {redeemed && <RedeemedTroveOverlay />}
      </TroveEditor>

      {redeemed ? (
        <CollateralSurplusAction />
      ) : (
        <TroveAction {...{ original, edited, afterFee, change, changePending, dispatch }} />
      )}
    </>
  );
};
