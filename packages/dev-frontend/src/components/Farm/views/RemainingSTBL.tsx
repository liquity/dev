import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingXbrlWethLiquidityMiningSTBLReward }: LiquityStoreState) => ({
  remainingXbrlWethLiquidityMiningSTBLReward
});

export const RemainingSTBL: React.FC = () => {
  const { remainingXbrlWethLiquidityMiningSTBLReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingXbrlWethLiquidityMiningSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
