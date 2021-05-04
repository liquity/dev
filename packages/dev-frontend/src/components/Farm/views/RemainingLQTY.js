import { Flex } from "theme-ui";

import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingLiquidityMiningLQTYReward }) => ({
  remainingLiquidityMiningLQTYReward
});

export const RemainingLQTY = () => {
  const { remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingLiquidityMiningLQTYReward.prettify(0)} LQTY remaining
    </Flex>
  );
};
