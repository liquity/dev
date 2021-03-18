import React, { useCallback } from "react";
import { Flex, Button } from "theme-ui";

import {
  LiquityStoreState,
  Decimal,
  Decimalish,
  LUSD_MINIMUM_DEBT,
  Trove,
  TroveAdjustmentParams
} from "@liquity/lib-base";

import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../strings";

import { TroveEditor } from "./TroveEditor";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";
import { ActionDescription } from "../ActionDescription";

const describeAdjustment = ({
  depositCollateral,
  withdrawCollateral,
  borrowLUSD,
  repayLUSD
}: TroveAdjustmentParams<Decimal>) =>
  depositCollateral && borrowLUSD
    ? `You will deposit ${depositCollateral.prettify()} ETH ` +
      `and receive ${borrowLUSD.prettify()} ${COIN}.`
    : repayLUSD && withdrawCollateral
    ? `You will pay ${repayLUSD.prettify()} ${COIN} and ` +
      `receive ${withdrawCollateral.prettify()} ETH.`
    : depositCollateral && repayLUSD
    ? `You will deposit ${depositCollateral.prettify()} ETH and ` +
      `pay ${repayLUSD.prettify()} ${COIN}.`
    : borrowLUSD && withdrawCollateral
    ? `You will receive ${withdrawCollateral.prettify()} ETH and ` +
      `${borrowLUSD.prettify()} ${COIN}.`
    : depositCollateral
    ? `You will deposit ${depositCollateral.prettify()} ETH.`
    : withdrawCollateral
    ? `You will receive ${withdrawCollateral.prettify()} ETH.`
    : borrowLUSD
    ? `You will receive ${borrowLUSD.prettify()} ${COIN}.`
    : repayLUSD
    ? `You will pay ${repayLUSD.prettify()} ${COIN}.`
    : "";

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
          return addMinimumDebt(newState);
        }
        if (addedMinimumDebt && newCollateral.isZero) {
          return removeMinimumDebt(newState);
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
  }
};

const select = ({ fees }: LiquityStoreState) => ({
  fees
});

export const TroveManager: React.FC = () => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);
  const { fees } = useLiquitySelector(select);

  const borrowingRate = fees.borrowingRate();
  const change = original.whatChanged(edited, borrowingRate);
  // Reapply change to get the exact state the Trove will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const afterFee = original.apply(change, borrowingRate);
  const maxBorrowingRate = borrowingRate.add(0.005); // TODO slippage tolerance

  // console.log("TroveManager render", { original, edited, change });
  const { dispatchEvent } = useTroveView();

  const handleCancel = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <TroveEditor
      original={original}
      edited={edited}
      borrowingRate={borrowingRate}
      change={change}
      changePending={changePending}
      dispatch={dispatch}
    >
      {change && change.type !== "invalidCreation" && (
        <ActionDescription>{describeAdjustment(change.params)}</ActionDescription>
      )}

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleCancel}>
          Cancel
        </Button>

        <TroveAction
          original={original}
          edited={edited}
          maxBorrowingRate={maxBorrowingRate}
          afterFee={afterFee}
          change={change}
          changePending={changePending}
          dispatch={dispatch}
        />
      </Flex>
    </TroveEditor>
  );
};
