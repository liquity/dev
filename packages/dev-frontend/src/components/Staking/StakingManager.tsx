import { Button, Flex } from "theme-ui";

import { Decimal, LiquityStoreState, LQTYStake, LQTYStakeChange } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { GT, COIN } from "../../strings";

import { useStakingView } from "./context/StakingViewContext";
import { StakingEditor } from "./StakingEditor";
import { StakingManagerAction } from "./StakingManagerAction";
import { ActionDescription, Amount } from "../ActionDescription";
import { ErrorDescription } from "../ErrorDescription";
import { useStakingManager } from "./context/StakingManagerContext";

const selectLQTYBalance = ({ lqtyBalance }: LiquityStoreState) => lqtyBalance;

type StakingManagerActionDescriptionProps = {
  originalStake: LQTYStake;
  change: LQTYStakeChange<Decimal>;
};

const StakingManagerActionDescription: React.FC<StakingManagerActionDescriptionProps> = ({
  originalStake,
  change
}) => {
  const stakeLQTY = change.stakeLQTY?.prettify().concat(" ", GT);
  const unstakeLQTY = change.unstakeLQTY?.prettify().concat(" ", GT);
  const collateralGain = originalStake.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const lusdGain = originalStake.lusdGain.nonZero?.prettify().concat(" ", COIN);

  if (originalStake.isEmpty && stakeLQTY) {
    return (
      <ActionDescription>
        You are staking <Amount>{stakeLQTY}</Amount>.
      </ActionDescription>
    );
  }

  return (
    <ActionDescription>
      {stakeLQTY && (
        <>
          You are adding <Amount>{stakeLQTY}</Amount> to your stake
        </>
      )}
      {unstakeLQTY && (
        <>
          You are withdrawing <Amount>{unstakeLQTY}</Amount> to your wallet
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

  const {
    state: { originalStake, editedLQTY }
  } = useStakingManager();

  const lqtyBalance = useLiquitySelector(selectLQTYBalance);

  const change = originalStake.whatChanged(editedLQTY);
  const [validChange, description] = !change
    ? [undefined, undefined]
    : change.stakeLQTY?.gt(lqtyBalance)
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
    : [change, <StakingManagerActionDescription originalStake={originalStake} change={change} />];

  const makingNewStake = originalStake.isEmpty;

  return (
    <StakingEditor title={"Staking"}>
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
