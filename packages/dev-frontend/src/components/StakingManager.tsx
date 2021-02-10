import React, { useEffect } from "react";
import { Button, Flex, Spinner } from "theme-ui";

import { Decimal, Decimalish, LQTYStake, LiquityStoreState } from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { COIN, GT } from "../strings";

import { StakingEditor } from "./StakingEditor";
import { Transaction, TransactionFunction, useMyTransactionState } from "./Transaction";

type StakingActionProps = {
  originalStake: LQTYStake;
  editedLQTY: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const selectLQTYBalance = ({ lqtyBalance }: LiquityStoreState) => lqtyBalance;

type Action = [name: string, send: TransactionFunction, requirements?: [boolean, string][]];

const StakingAction: React.FC<StakingActionProps> = ({
  originalStake,
  editedLQTY,
  changePending,
  dispatch
}) => {
  const lqtyBalance = useLiquitySelector(selectLQTYBalance);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "stake";
  const myTransactionState = useMyTransactionState(/^stake-/);

  const { stakeLQTY, unstakeLQTY } = originalStake.whatChanged(editedLQTY) ?? {};

  const collateralGain = originalStake.collateralGain.nonZero;
  const lusdGain = originalStake.lusdGain.nonZero;
  const gains =
    (collateralGain ?? lusdGain) &&
    [collateralGain && "ETH", lusdGain && COIN].filter(x => x).join(" & ");

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    }
  }, [myTransactionState.type, dispatch]);

  if (!stakeLQTY && !unstakeLQTY && !gains) {
    return null;
  }

  const actions: Action[] = stakeLQTY
    ? [
        [
          gains
            ? `Stake ${stakeLQTY.prettify()} ${GT} & claim ${gains}`
            : `Stake ${stakeLQTY.prettify()} ${GT}`,
          liquity.stakeLQTY.bind(liquity, stakeLQTY),
          [[lqtyBalance.gte(stakeLQTY), `You don't have enough ${GT}`]]
        ]
      ]
    : unstakeLQTY
    ? [
        [
          gains
            ? `Unstake ${unstakeLQTY.prettify()} ${GT} & claim ${gains}`
            : `Unstake ${unstakeLQTY.prettify()} ${GT}`,
          liquity.unstakeLQTY.bind(liquity, unstakeLQTY)
        ]
      ]
    : gains
    ? [[`Claim ${gains}`, liquity.withdrawGainsFromStaking.bind(liquity)]]
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

const init = ({ lqtyStake }: LiquityStoreState) => ({
  originalStake: lqtyStake,
  editedLQTY: lqtyStake.stakedLQTY,
  changePending: false
});

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | LiquityStoreUpdate
  | { type: "startChange" | "finishChange" | "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduceWith = (action: StakeManagerAction) => (state: StakeManagerState): StakeManagerState =>
  reduce(state, action);

const finishChange = reduceWith({ type: "finishChange" });
const revert = reduceWith({ type: "revert" });

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedLQTY, changePending } = state;

  switch (action.type) {
    case "startChange":
      return { ...state, changePending: true };

    case "finishChange":
      return { ...state, changePending: false };

    case "setStake":
      return { ...state, editedLQTY: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedLQTY: originalStake.stakedLQTY };

    case "updateStore": {
      const {
        stateChange: { lqtyStake: updatedStake }
      } = action;

      if (!updatedStake) {
        return state;
      }

      const newState = { ...state, originalStake: updatedStake };

      const changeCommitted =
        !updatedStake.stakedLQTY.eq(originalStake.stakedLQTY) ||
        updatedStake.collateralGain.lt(originalStake.collateralGain) ||
        updatedStake.lusdGain.lt(originalStake.lusdGain);

      if (changePending && changeCommitted) {
        return finishChange(revert(newState));
      }

      return {
        ...newState,
        editedLQTY: updatedStake.apply(originalStake.whatChanged(editedLQTY))
      };
    }
  }
};

export const StakingManager: React.FC = () => {
  const [{ originalStake, editedLQTY, changePending }, dispatch] = useLiquityReducer(reduce, init);

  return (
    <>
      <StakingEditor
        title={originalStake.isEmpty ? "Stake LQTY to earn ETH & LUSD" : "My LQTY Stake"}
        {...{ originalStake, editedLQTY, changePending, dispatch }}
      />

      <StakingAction {...{ originalStake, editedLQTY, changePending, dispatch }} />
    </>
  );
};
