import React from "react";
import { Flex } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingStabilityPoolSTBLReward }: LiquityStoreState) => ({
  remainingStabilityPoolSTBLReward
});

export const RemainingSTBL: React.FC = () => {
  const { remainingStabilityPoolSTBLReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolSTBLReward.prettify(0)} STBL remaining
    </Flex>
  );
};
