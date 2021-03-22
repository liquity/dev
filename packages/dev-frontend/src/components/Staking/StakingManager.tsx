import React from "react";
import { Button, Flex } from "theme-ui";

import {
  Decimal,
  Decimalish,
  LiquityStoreState,
  LQTYStake,
  LQTYStakeChange
} from "@liquity/lib-base";

import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";

const init = ({ lqtyStake }: LiquityStoreState) => ({
  originalStake: lqtyStake,
  editedLQTY: lqtyStake.stakedLQTY
});

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | LiquityStoreUpdate
  | { type: "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedLQTY } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedLQTY: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedLQTY: originalStake.stakedLQTY };

    case "updateStore": {
      const {
        stateChange: { lqtyStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedLQTY: updatedStake.apply(originalStake.whatChanged(editedLQTY))
        };
      }
    }
  }

  return state;
};

const selectLQTYBalance = ({ lqtyBalance }: LiquityStoreState) => lqtyBalance;

type StakingManagerActionDescriptionProps = {
  stake: LQTYStake;
  change: LQTYStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  stake: { collateralGain, lusdGain },
  change
}) => {
  const gains = [
    collateralGain.nonZero?.prettify(4).concat(" ETH"),
    lusdGain.nonZero?.prettify().concat(" ", COIN)
  ].filter(x => x);

  return (
    <ActionDescription>
      {change.stakeLQTY && (
        <>
          You are staking{" "}
          <Amount>
            {change.stakeLQTY.prettify()} {GT}
          </Amount>
        </>
      )}
      {change.unstakeLQTY && (
        <>
          You are withdrawing{" "}
          <Amount>
            {change.unstakeLQTY.prettify()} {GT}
          </Amount>
        </>
      )}
      {gains.length > 0 && (
        <>
          {" "}
          and claiming{" "}
          {gains.length === 2 ? (
            <>
              <Amount>{gains[0]}</Amount> and <Amount>{gains[1]}</Amount>
            </>
          ) : (
            <>
              <Amount>{gains[0]}</Amount>
            </>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};

export const StakingManager: React.FC = () => {
  const { dispatch: dispatchStakingViewAction } = useStakingView();
  const [{ originalStake, editedLQTY }, dispatch] = useLiquityReducer(reduce, init);
  const lqtyBalance = useLiquitySelector(selectLQTYBalance);

  const change = originalStake.whatChanged(editedLQTY);
  const [validChange, description] = change?.stakeLQTY?.gt(lqtyBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeLQTY.sub(lqtyBalance).prettify()} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, change && <StakingManagerActionDescription stake={originalStake} change={change} />];

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedLQTY, dispatch }}>
      {description}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={() => dispatchStakingViewAction({ type: "cancelAdjusting" })}
        >
          Cancel
        </Button>

        {validChange ? (
          <StakingManagerAction change={validChange}>Confirm</StakingManagerAction>
        ) : (
          <Button disabled>Confirm</Button>
        )}
      </Flex>
    </StakingEditor>
  );
};
