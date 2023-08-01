import React from "react";
import { Flex } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

const selector = ({ remainingXbrlStblLiquidityMiningSTBLReward }: StabilioStoreState) => ({
  remainingXbrlStblLiquidityMiningSTBLReward
});

export const XbrlStblRemainingSTBL: React.FC = () => {
  const { remainingXbrlStblLiquidityMiningSTBLReward } = useStabilioSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingXbrlStblLiquidityMiningSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
