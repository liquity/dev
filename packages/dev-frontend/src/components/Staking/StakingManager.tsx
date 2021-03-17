import React from "react";
import { Button, Flex, Paragraph } from "theme-ui";

import {
  Decimal,
  Decimalish,
  LiquityStoreState,
  LQTYStake,
  LQTYStakeChange
} from "@liquity/lib-base";
import { LiquityStoreUpdate, useLiquityReducer } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";

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

const describeGains = ({ collateralGain, lusdGain }: LQTYStake) => {
  const gains = [
    collateralGain.nonZero?.prettify(4).concat(" ETH"),
    lusdGain.nonZero?.prettify().concat(" ", COIN)
  ].filter(x => x);

  return gains.length > 0 ? " and claiming " + gains.join(" and ") : "";
};

const describeAction = (stake: LQTYStake, change: LQTYStakeChange<Decimal>) =>
  (change.stakeLQTY
    ? `You are staking ${change.stakeLQTY.prettify()} ${GT}`
    : `You are withdrawing ${change.unstakeLQTY.prettify()} ${GT}`) +
  describeGains(stake) +
  ".";

export const StakingManager: React.FC = () => {
  const { dispatch: dispatchStakingViewAction } = useStakingView();
  const [{ originalStake, editedLQTY }, dispatch] = useLiquityReducer(reduce, init);
  const change = originalStake.whatChanged(editedLQTY);

  return (
    <StakingEditor title={"Staking"} {...{ originalStake, editedLQTY, dispatch }}>
      {!originalStake.isEmpty && change && (
        <Paragraph sx={{ m: 3, fontSize: 2 }}>{describeAction(originalStake, change)}</Paragraph>
      )}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={() => dispatchStakingViewAction({ type: "cancelAdjusting" })}
        >
          Cancel
        </Button>

        <StakingManagerAction {...{ change, dispatch }} />
      </Flex>
    </StakingEditor>
  );
};
