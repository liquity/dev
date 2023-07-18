import React from "react";
import { Flex } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

const selector = ({ remainingXbrlWethLiquidityMiningSTBLReward }: StabilioStoreState) => ({
  remainingXbrlWethLiquidityMiningSTBLReward
});

export const RemainingSTBL: React.FC = () => {
  const { remainingXbrlWethLiquidityMiningSTBLReward } = useStabilioSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingXbrlWethLiquidityMiningSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
