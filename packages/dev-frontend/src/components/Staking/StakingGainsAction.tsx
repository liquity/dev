import { Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";

import { Transaction } from "../Transaction";

import { useStakingView } from "./context/StakingViewContext";

const selectLQTYStake = ({ lqtyStake }: LiquityStoreState) => lqtyStake;

export const StakingGainsAction: React.FC = () => {
  const { changePending } = useStakingView();
  const lqtyStake = useLiquitySelector(selectLQTYStake);
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const collateralGain = lqtyStake.collateralGain.nonZero;
  const lusdGain = lqtyStake.lusdGain.nonZero;

  if ((!collateralGain && !lusdGain) || changePending) {
    return <Button disabled>Claim gains</Button>;
  }

  return (
    <Transaction
      id="stake"
      failureDisplayType="asTooltip"
      tooltipPlacement="bottom"
      send={liquity.withdrawGainsFromStaking.bind(liquity)}
    >
      <Button>Claim gains</Button>
    </Transaction>
  );
};
