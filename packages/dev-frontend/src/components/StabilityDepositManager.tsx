import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { StabilityDeposit, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { StabilityDepositEditor } from "./StabilityDepositEditor";
import { Transaction, TransactionFunction, useMyTransactionState } from "./Transaction";
import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";
import { Decimal, Decimalish } from "@liquity/decimal";

type StabilityDepositActionProps = {
  originalDeposit: StabilityDeposit;
  editedDeposit: Decimal;
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
  editedDeposit,
  changePending,
  dispatch
}) => {
  const { trove, price, lusdBalance, numberOfTroves } = useLiquitySelector(select);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(/^stability-deposit-/);

  const { depositLUSD, withdrawLUSD } = originalDeposit.whatChanged(editedDeposit) ?? {};
  const collateralGain = originalDeposit.collateralGain.nonZero;

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
          collateralGain
            ? `Deposit ${depositLUSD.prettify()} ${COIN} & ` +
              `withdraw ${collateralGain.prettify(4)} ETH`
            : `Deposit ${depositLUSD.prettify()} ${COIN}`,
          liquity.depositLUSDInStabilityPool.bind(liquity, depositLUSD, undefined),
          [[lusdBalance.gte(depositLUSD), `You don't have enough ${COIN}`]]
        ]
      ]
    : withdrawLUSD
    ? [
        [
          collateralGain
            ? `Withdraw ${withdrawLUSD.prettify()} ${COIN} & ${collateralGain.prettify(4)} ETH`
            : `Withdraw ${withdrawLUSD.prettify()} ${COIN}`,
          liquity.withdrawLUSDFromStabilityPool.bind(liquity, withdrawLUSD)
        ]
      ]
    : collateralGain
    ? [
        [
          `Withdraw ${collateralGain.prettify(4)} ETH`,
          liquity.withdrawLUSDFromStabilityPool.bind(liquity, 0)
        ],
        ...(!trove.isEmpty
          ? [
              [
                `Transfer ${collateralGain.prettify(4)} ETH to Trove`,
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
  editedDeposit: deposit.current,
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

  const { originalDeposit, editedDeposit, changePending } = state;

  switch (action.type) {
    case "startChange":
      return { ...state, changePending: true };

    case "finishChange":
      return { ...state, changePending: false };

    case "setDeposit":
      return { ...state, editedDeposit: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedDeposit: originalDeposit.current };

    case "updateStore": {
      const {
        stateChange: { deposit: updatedDeposit }
      } = action;

      if (!updatedDeposit) {
        return state;
      }

      const newState = { ...state, originalDeposit: updatedDeposit };

      const changeCommitted =
        !updatedDeposit.initial.eq(originalDeposit.initial) ||
        updatedDeposit.current.gt(originalDeposit.current) ||
        updatedDeposit.collateralGain.lt(originalDeposit.collateralGain);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedDeposit: updatedDeposit.apply(originalDeposit.whatChanged(editedDeposit))
      };
    }
  }
};

export const StabilityDepositManager: React.FC = () => {
  const [{ originalDeposit, editedDeposit, changePending }, dispatch] = useLiquityReducer(
    reduce,
    init
  );

  return (
    <>
      <StabilityDepositEditor
        title={originalDeposit.isEmpty ? "Make a Stability Deposit" : "My Stability Deposit"}
        {...{ originalDeposit, editedDeposit, changePending, dispatch }}
      />

      <StabilityDepositAction {...{ originalDeposit, editedDeposit, changePending, dispatch }} />
    </>
  );
};
