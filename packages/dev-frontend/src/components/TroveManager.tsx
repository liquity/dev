import React from "react";

import { LiquityStoreState, Decimal, Decimalish, LUSD_MINIMUM_DEBT, Trove } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { RedeemedTroveOverlay } from "./RedeemedTroveOverlay";
import { CollateralSurplusAction } from "./CollateralSurplusAction";

const init = ({ trove }: LiquityStoreState) => ({
  original: trove,
  edited: new Trove(trove.collateral, trove.debt),
  changePending: false,
  debtDirty: false,
  addedMinimumDebt: false
});

type TroveManagerState = ReturnType<typeof init>;
type TroveManagerAction =
  | LiquityStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" | "addMinimumDebt" | "removeMinimumDebt" }
  | { type: "setCollateral" | "setDebt"; newValue: Decimalish };

const reduceWith = (action: TroveManagerAction) => (state: TroveManagerState): TroveManagerState =>
  reduce(state, action);

const addMinimumDebt = reduceWith({ type: "addMinimumDebt" });
const removeMinimumDebt = reduceWith({ type: "removeMinimumDebt" });
const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: TroveManagerState, action: TroveManagerAction): TroveManagerState => {
  // console.log(state);
  // console.log(action);

  const { original, edited, changePending, debtDirty, addedMinimumDebt } = state;

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
          return addMinimumDebt(newState);
        }
        if (addedMinimumDebt && newCollateral.isZero) {
          return removeMinimumDebt(newState);
        }
      }

      return newState;
    }

    case "setDebt":
      return { ...state, edited: edited.setDebt(action.newValue), debtDirty: true };

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

      const newState = { ...state, original: trove };

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

const select = ({ fees, collateralSurplusBalance }: LiquityStoreState) => ({
  fees,
  redeemed: !collateralSurplusBalance.isZero
});

export const TroveManager: React.FC = () => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees, redeemed } = useLiquitySelector(select);

  const borrowingRate = fees.borrowingRate();
  const change = original.whatChanged(edited, borrowingRate);
  // Reapply change to get the exact state the Trove will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const afterFee = original.apply(change, borrowingRate);
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  return (
    <>
      <TroveEditor {...{ original, edited, borrowingRate, change, changePending, dispatch }}>
        {redeemed && <RedeemedTroveOverlay />}
      </TroveEditor>

      {redeemed ? (
        <CollateralSurplusAction />
      ) : (
        <TroveAction
          {...{ original, edited, maxBorrowingRate, afterFee, change, changePending, dispatch }}
        />
      )}
    </>
  );
};
