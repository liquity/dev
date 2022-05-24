import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";

const selector = ({ remainingLiquidityMiningLQTYReward }: LiquityStoreState) => ({
  remainingLiquidityMiningLQTYReward
});

export const RemainingLQTY: React.FC = () => {
  const { remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningLQTYReward.prettify(0)} OPAL remaining
    </Flex>
  );
};
