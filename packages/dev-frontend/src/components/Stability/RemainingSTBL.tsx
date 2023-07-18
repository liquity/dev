import React from "react";
import { Flex } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

const selector = ({ remainingStabilityPoolSTBLReward }: StabilioStoreState) => ({
  remainingStabilityPoolSTBLReward
});

export const RemainingSTBL: React.FC = () => {
  const { remainingStabilityPoolSTBLReward } = useStabilioSelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
