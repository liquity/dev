import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import React from "react";
import { Flex } from "theme-ui";

const selector = ({ remainingLiquidityMiningLQTYReward }: LiquityStoreState) => ({
  remainingLiquidityMiningLQTYReward
});

export const RemainingLQTY: React.FC = () => {
  const { remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ fontSize: 2, fontWeight: "bold" }}>
      {remainingLiquidityMiningLQTYReward.prettify(0)} LQTY remaining
    </Flex>
  );
};
