import { Button } from "theme-ui";

import { Decimal, LiquityStoreState, LQTYStakeChange } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { GT } from "../../strings";

import { Transaction, TransactionFunction } from "../Transaction";

import { useStakingView } from "./context/StakingViewContext";

type StakingActionProps = {
  change: LQTYStakeChange<Decimal> | undefined;
};

const selectLQTYBalance = ({ lqtyBalance }: LiquityStoreState) => lqtyBalance;

type Action = [send: TransactionFunction, requirements?: [boolean, string][]];

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change }) => {
  const { changePending } = useStakingView();
  const lqtyBalance = useLiquitySelector(selectLQTYBalance);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const { stakeLQTY, unstakeLQTY } = change ?? {};

  const action: Action | undefined = stakeLQTY
    ? [
        liquity.stakeLQTY.bind(liquity, stakeLQTY),
        [[lqtyBalance.gte(stakeLQTY), `You don't have enough ${GT}`]]
      ]
    : unstakeLQTY
    ? [liquity.unstakeLQTY.bind(liquity, unstakeLQTY)]
    : undefined;

  if (!action || changePending) {
    return <Button disabled>Confirm</Button>;
  }

  const [send, requires] = action;

  return (
    <Transaction
      id="stake"
      failureDisplayType="asTooltip"
      tooltipPlacement="bottom"
      {...{ send, requires }}
    >
      <Button>Confirm</Button>
    </Transaction>
  );
};
