import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { StabilityDeposit, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { Transaction, TransactionFunction, useMyTransactionState } from "./Transaction";
import { useLiquity } from "../hooks/LiquityContext";
import { COIN, GT } from "../strings";
import { Decimal, Decimalish } from "@liquity/decimal";

type StabilityDepositActionProps = {
  originalDeposit: StabilityDeposit;
  editedLUSD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const select = ({ trove, price, lusdBalance, numberOfTroves }: LiquityStoreState) => ({
  trove,
  price,
  lusdBalance,
  numberOfTroves
});

type Action = [name: string, send: TransactionFunction, requirements?: [boolean, string][]];

const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  originalDeposit,
  editedLUSD,
  changePending,
  dispatch
}) => {
  const { trove, price, lusdBalance, numberOfTroves } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(/^stability-deposit-/);

  const { depositLUSD, withdrawLUSD } = originalDeposit.whatChanged(editedLUSD) ?? {};

  const collateralGain = originalDeposit.collateralGain.nonZero;
  const lqtyReward = originalDeposit.lqtyReward.nonZero;
  const rewards =
    (collateralGain ?? lqtyReward) &&
    [collateralGain && "ETH", lqtyReward && GT].filter(x => x).join(" & ");

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    }
  }, [myTransactionState.type, dispatch]);

  if (!depositLUSD && !withdrawLUSD && !collateralGain) {
    return null;
  }

  const actions: Action[] = depositLUSD
    ? [
        [
          rewards
            ? `Deposit ${depositLUSD.prettify()} ${COIN} & claim ${rewards}`
            : `Deposit ${depositLUSD.prettify()} ${COIN}`,
          liquity.depositLUSDInStabilityPool.bind(liquity, depositLUSD, undefined),
          [[lusdBalance.gte(depositLUSD), `You don't have enough ${COIN}`]]
        ]
      ]
    : withdrawLUSD
    ? [
        [
          rewards
            ? `Withdraw ${withdrawLUSD.prettify()} ${COIN} & claim ${rewards}`
            : `Withdraw ${withdrawLUSD.prettify()} ${COIN}`,
          liquity.withdrawLUSDFromStabilityPool.bind(liquity, withdrawLUSD)
        ]
      ]
    : rewards
    ? [
        [`Claim ${rewards}`, liquity.withdrawGainsFromStabilityPool.bind(liquity)],
        ...(collateralGain && !trove.isEmpty
          ? [
              [
                lqtyReward ? `Transfer ETH to Trove & claim ${GT}` : `Transfer ETH to Trove`,
                liquity.transferCollateralGainToTrove.bind(liquity, {
                  deposit: originalDeposit,
                  trove,
                  price,
                  numberOfTroves
                })
              ] as Action
            ]
          : [])
      ]
    : [];

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex sx={{ mt: [0, 0, 3], flexWrap: "wrap", justifyContent: "center" }}>
      {actions.map(([actionName], i) => (
        <Button key={i} disabled sx={{ mt: 3, mx: 2 }}>
          {myTransactionState.id === `${myTransactionId}-${i}` ? (
            <>
              <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
              Waiting for your approval
            </>
          ) : (
            actionName
          )}
        </Button>
      ))}
    </Flex>
  ) : changePending ? null : (
    <Flex sx={{ mt: [0, null, 3], flexWrap: "wrap", justifyContent: "center" }}>
      {actions.map(([actionName, send, requires], i) => (
        <Transaction key={i} id={`${myTransactionId}-${i}`} {...{ send, requires }}>
          <Button sx={{ mt: 3, mx: 2 }}>{actionName}</Button>
        </Transaction>
      ))}
    </Flex>
  );
};

const init = ({ deposit }: LiquityStoreState) => ({
  originalDeposit: deposit,
  editedLUSD: deposit.currentLUSD,
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
    case "startChange":
      return { ...state, changePending: true };

    case "finishChange":
      return { ...state, changePending: false };

    case "setDeposit":
      return { ...state, editedLUSD: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedLUSD: originalDeposit.currentLUSD };

    case "updateStore": {
      const {
        stateChange: { deposit: updatedDeposit }
      } = action;

      if (!updatedDeposit) {
        return state;
      }

      const newState = { ...state, originalDeposit: updatedDeposit };

      const changeCommitted =
        !updatedDeposit.initialLUSD.eq(originalDeposit.initialLUSD) ||
        updatedDeposit.currentLUSD.gt(originalDeposit.currentLUSD) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain);

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

  return (
    <>
      <StabilityDepositEditor
        title={originalDeposit.isEmpty ? "Deposit LUSD to earn ETH & LQTY" : "My Stability Deposit"}
        {...{ originalDeposit, editedLUSD, changePending, dispatch }}
      />

      <StabilityDepositAction {...{ originalDeposit, editedLUSD, changePending, dispatch }} />
    </>
  );
};
