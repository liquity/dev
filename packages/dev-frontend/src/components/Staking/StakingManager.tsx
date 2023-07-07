import React from "react";
import { Button, Flex } from "theme-ui";

import {
  Decimal,
  Decimalish,
  LiquityStoreState,
  STBLStake,
  STBLStakeChange
} from "@liquity/lib-base";

import { LiquityStoreUpdate, useLiquityReducer, useLiquitySelector } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";

const init = ({ stblStake }: LiquityStoreState) => ({
  originalStake: stblStake,
  editedSTBL: stblStake.stakedSTBL
});

type StakeManagerState = ReturnType<typeof init>;
type StakeManagerAction =
  | LiquityStoreUpdate
  | { type: "revert" }
  | { type: "setStake"; newValue: Decimalish };

const reduce = (state: StakeManagerState, action: StakeManagerAction): StakeManagerState => {
  // console.log(state);
  // console.log(action);

  const { originalStake, editedSTBL } = state;

  switch (action.type) {
    case "setStake":
      return { ...state, editedSTBL: Decimal.from(action.newValue) };

    case "revert":
      return { ...state, editedSTBL: originalStake.stakedSTBL };

    case "updateStore": {
      const {
        stateChange: { stblStake: updatedStake }
      } = action;

      if (updatedStake) {
        return {
          originalStake: updatedStake,
          editedSTBL: updatedStake.apply(originalStake.whatChanged(editedSTBL))
        };
      }
    }
  }

  return state;
};

const selectSTBLBalance = ({ stblBalance }: LiquityStoreState) => stblBalance;

type StakingManagerActionDescriptionProps = {
  originalStake: STBLStake;
  change: STBLStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  originalStake,
  change
}) => {
  const stakeSTBL = change.stakeSTBL?.prettify().concat(" ", GT);
  const unstakeSTBL = change.unstakeSTBL?.prettify().concat(" ", GT);
  const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const lusdGain = originalStake.lusdGain.nonZero?.prettify().concat(" ", COIN);

  if (originalStake.isEmpty && stakeSTBL) {
    return (
      <ActionDescription>
        You are staking <Amount>{stakeSTBL}</Amount>.
      </ActionDescription>
    );
  }

  return (
    <ActionDescription>
      {stakeSTBL && (
        <>
          You are adding <Amount>{stakeSTBL}</Amount> to your stake
        </>
      )}
      {unstakeSTBL && (
        <>
          You are withdrawing <Amount>{unstakeSTBL}</Amount> to your wallet
        </>
      )}
      {(collateralGain || lusdGain) && (
        <>
          {" "}
          and claiming{" "}
          {collateralGain && lusdGain ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{lusdGain}</Amount>
            </>
          ) : (
            <>
              <Amount>{collateralGain ?? lusdGain}</Amount>
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
  const [{ originalStake, editedSTBL }, dispatch] = useLiquityReducer(reduce, init);
  const stblBalance = useLiquitySelector(selectSTBLBalance);

  const change = originalStake.whatChanged(editedSTBL);
  const [validChange, description] = !change
    ? [undefined, undefined]
    : change.stakeSTBL?.gt(stblBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeSTBL.sub(stblBalance).prettify()} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, <StakingManagerActionDescription originalStake={originalStake} change={change} />];

  const makingNewStake = originalStake.isEmpty;

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedSTBL, dispatch }}>
      {description ??
        (makingNewStake ? (
          <ActionDescription>Enter the amount of {GT} you'd like to stake.</ActionDescription>
        ) : (
          <ActionDescription>Adjust the {GT} amount to stake or withdraw.</ActionDescription>
        ))}

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
