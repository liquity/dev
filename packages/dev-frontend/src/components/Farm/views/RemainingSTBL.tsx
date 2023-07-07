import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingLiquidityMiningSTBLReward }: LiquityStoreState) => ({
  remainingLiquidityMiningSTBLReward
});

export const RemainingSTBL: React.FC = () => {
  const { remainingLiquidityMiningSTBLReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
