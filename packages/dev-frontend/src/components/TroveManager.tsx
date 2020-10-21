import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { Decimal, Decimalish, Percent } from "@liquity/decimal";
import { LiquityStoreState, Trove } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { TroveEditor } from "./TroveEditor";
import { Transaction, useMyTransactionState } from "./Transaction";
import { COIN } from "../strings";

type TroveActionProps = {
  original: Trove;
  edited: Trove;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const mcrPercent = new Percent(Trove.MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(Trove.CRITICAL_COLLATERAL_RATIO).toString(0);

const selectForTroveAction = ({ price, total, quiBalance, numberOfTroves }: LiquityStoreState) => ({
  price,
  total,
  quiBalance,
  numberOfTroves
});

const TroveAction: React.FC<TroveActionProps> = ({ original, edited, changePending, dispatch }) => {
  const { numberOfTroves, price, quiBalance, total } = useLiquitySelector(selectForTroveAction);
  const { liquity } = useLiquity();

  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const { collateralDifference, debtDifference } = original.whatChanged(edited);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    }
  }, [myTransactionState.type, dispatch]);

  if (!collateralDifference && !debtDifference) {
    return null;
  }

  const [actionName, send, extraRequirements] = original.isEmpty
    ? ([
        "Open new Trove",
        liquity.openTrove.bind(liquity, edited, { price, numberOfTroves }),
        edited.debt.nonZero
          ? ([
              [
                !total.collateralRatioIsBelowCritical(price),
                `Can't borrow ${COIN} during recovery mode`
              ],
              [
                !total.add(edited).collateralRatioIsBelowCritical(price),
                `Total collateral ratio would fall below ${ccrPercent}`
              ]
            ] as const)
          : []
      ] as const)
    : edited.isEmpty
    ? ([
        "Close Trove",
        liquity.closeTrove.bind(liquity),
        [
          [!total.collateralRatioIsBelowCritical(price), "Can't close Trove during recovery mode"],
          [
            quiBalance.add(Trove.GAS_COMPENSATION_DEPOSIT).gte(original.debt),
            `You don't have enough ${COIN}`
          ]
        ]
      ] as const)
    : ([
        collateralDifference && debtDifference
          ? collateralDifference.positive && debtDifference.positive
            ? `Deposit ${collateralDifference.absoluteValue!.prettify()} ETH & ` +
              `borrow ${debtDifference.absoluteValue!.prettify()} ${COIN}`
            : collateralDifference.negative && debtDifference.negative
            ? `Repay ${debtDifference.absoluteValue!.prettify()} ${COIN} & ` +
              `withdraw ${collateralDifference.absoluteValue!.prettify()} ETH`
            : collateralDifference.positive
            ? `Deposit ${collateralDifference.absoluteValue!.prettify()} ETH & ` +
              `repay ${debtDifference.absoluteValue!.prettify()} ${COIN}`
            : `Borrow ${debtDifference.absoluteValue!.prettify()} ${COIN} & ` +
              `withdraw ${collateralDifference.absoluteValue!.prettify()} ETH`
          : collateralDifference
          ? `${collateralDifference.positive ? "Deposit" : "Withdraw"} ` +
            `${collateralDifference.absoluteValue!.prettify()} ETH`
          : `${debtDifference!.positive ? "Borrow" : "Repay"} ` +
            `${debtDifference!.absoluteValue!.prettify()} ${COIN}`,

        collateralDifference && debtDifference
          ? liquity.changeTrove.bind(
              liquity,
              { collateralDifference, debtDifference },
              { trove: original, price, numberOfTroves }
            )
          : (collateralDifference
              ? collateralDifference.positive
                ? liquity.depositEther
                : liquity.withdrawEther
              : debtDifference!.positive
              ? liquity.borrowQui
              : liquity.repayQui
            ).bind(liquity, (collateralDifference ?? debtDifference)!.absoluteValue!, {
              trove: original,
              price,
              numberOfTroves
            }),
        [
          ...(collateralDifference?.negative
            ? ([
                [
                  !total.collateralRatioIsBelowCritical(price),
                  "Can't withdraw ETH during recovery mode"
                ]
              ] as const)
            : []),
          ...(debtDifference?.positive
            ? ([
                [
                  !total.collateralRatioIsBelowCritical(price),
                  `Can't borrow ${COIN} during recovery mode`
                ],
                [
                  !total
                    .subtract(original)
                    .add(edited)
                    .collateralRatioIsBelowCritical(price),
                  `Total collateral ratio would fall below ${ccrPercent}`
                ]
              ] as const)
            : []),
          ...(debtDifference?.negative
            ? ([
                [quiBalance.gte(debtDifference.absoluteValue!), `You don't have enough ${COIN}`]
              ] as const)
            : [])
        ]
      ] as const);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        requires={[
          [
            !edited.collateralRatioIsBelowMinimum(price),
            `Collateral ratio must be at least ${mcrPercent}`
          ],
          [
            edited.isEmpty || edited.debt.gte(Trove.GAS_COMPENSATION_DEPOSIT),
            `Need at least ${Trove.GAS_COMPENSATION_DEPOSIT} ${COIN} for gas compensation`
          ],
          ...extraRequirements
        ]}
        {...{ send }}
      >
        <Button sx={{ mx: 2 }}>{actionName}</Button>
      </Transaction>
    </Flex>
  );
};

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

const addDebtCompensation = (state: TroveManagerState) =>
  reduce(state, { type: "addDebtCompensation" });

const removeDebtCompensation = (state: TroveManagerState) =>
  reduce(state, { type: "removeDebtCompensation" });

const finishChange = (state: TroveManagerState) => reduce(state, { type: "finishChange" });

const revert = (state: TroveManagerState) => reduce(state, { type: "revert" });

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
        edited: edited.setDebt(Trove.GAS_COMPENSATION_DEPOSIT),
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
        stateChange: { troveWithoutRewards: changeCommitted }
      } = action;

      let newState = {
        ...state,
        original: trove,
        edited:
          !original.isEmpty && edited.isEmpty ? edited : trove.apply(original.whatChanged(edited))
      };

      if ((changePending || original.isEmpty) && changeCommitted) {
        newState = revert(newState);
        if (changePending) {
          newState = finishChange(newState);
        }
      }

      return newState;
    }
  }
};

export const TroveManager: React.FC = () => {
  const [{ original, edited, changePending }, dispatch] = useLiquityReducer(reduce, init);

  return (
    <>
      <TroveEditor
        title={original.isEmpty ? "Open a new Liquity Trove" : "My Liquity Trove"}
        {...{ original, edited, changePending, dispatch }}
      />

      <TroveAction {...{ original, edited, changePending, dispatch }} />
    </>
  );
};
