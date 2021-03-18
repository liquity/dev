import React, { useEffect } from "react";
import { Button } from "theme-ui";

import {
  LUSD_MINIMUM_DEBT,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  Decimal,
  Percent,
  LiquityStoreState,
  Trove,
  TroveChange
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { COIN } from "../../strings";

import { Transaction, TransactionFunction, useMyTransactionState } from "../Transaction";
import { useTroveView } from "./context/TroveViewContext";

type TroveActionProps = {
  original: Trove;
  edited: Trove;
  maxBorrowingRate: Decimal;
  afterFee: Trove;
  change?: TroveChange<Decimal>;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

const select = ({ price, total, lusdBalance, numberOfTroves }: LiquityStoreState) => ({
  price,
  total,
  lusdBalance,
  numberOfTroves
});

type Action = [send: TransactionFunction, requirements?: [boolean, string][]];

export const TroveAction: React.FC<TroveActionProps> = ({
  original,
  edited,
  maxBorrowingRate,
  afterFee,
  change,
  changePending,
  dispatch
}) => {
  const { numberOfTroves, price, lusdBalance, total } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const { dispatchEvent } = useTroveView();

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_ADJUSTED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  if (!change) {
    return <Button disabled>Confirm</Button>;
  }

  if (change.type === "invalidCreation") {
    // Yuck, Transaction needs refactoring
    return (
      <Transaction
        id={myTransactionId}
        showFailure="asTooltip"
        tooltipPlacement="bottom"
        requires={[[false, `Debt should be at least ${LUSD_MINIMUM_DEBT} ${COIN}`]]}
        send={() => {
          throw new Error("shouldn't be called");
        }}
      >
        <Button>Confirm</Button>
      </Transaction>
    );
  }

  const [send, extraRequirements]: Action =
    change.type === "creation"
      ? [
          liquity.openTrove.bind(liquity, change.params, maxBorrowingRate),
          [
            [
              afterFee.isOpenableInRecoveryMode(price) ||
                !total.collateralRatioIsBelowCritical(price),
              `Can't open Trove with less than ${ccrPercent} collateral ratio during recovery mode`
            ]
          ]
        ]
      : change.type === "closure"
      ? [
          liquity.closeTrove.bind(liquity),
          [
            [!total.collateralRatioIsBelowCritical(price), "Can't close Trove during recovery mode"],
            [numberOfTroves > 1, "Can't close when no other Trove exists"]
          ]
        ]
      : [
          liquity.adjustTrove.bind(liquity, change.params, maxBorrowingRate),
          [
            [
              afterFee.collateralRatio(price).gte(original.collateralRatio(price)) ||
                !total.collateralRatioIsBelowCritical(price),
              "Can't decrease collateral ratio during recovery mode"
            ]
          ]
        ];

  return changePending ? (
    <Button disabled>Confirm</Button>
  ) : (
    <Transaction
      id={myTransactionId}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
      requires={[
        [
          edited.isEmpty || afterFee.debt.gte(LUSD_MINIMUM_DEBT),
          `Debt should be at least ${LUSD_MINIMUM_DEBT} ${COIN}`
        ],
        [
          !(
            change.type === "creation" ||
            (change.type === "adjustment" &&
              (change.params.withdrawCollateral || change.params.borrowLUSD))
          ) || !afterFee.collateralRatioIsBelowMinimum(price),
          `Collateral ratio must be at least ${mcrPercent}`
        ],
        [
          !(
            change.type === "creation" ||
            (change.type === "adjustment" && change.params.borrowLUSD)
          ) ||
            total.collateralRatioIsBelowCritical(price) ||
            !total.subtract(original).add(afterFee).collateralRatioIsBelowCritical(price),
          `Total collateral ratio would fall below ${ccrPercent}`
        ],
        [lusdBalance.gte(change.params.repayLUSD ?? 0), `You don't have enough ${COIN}`],
        ...extraRequirements
      ]}
      {...{ send }}
    >
      <Button>Confirm</Button>
    </Transaction>
  );
};
