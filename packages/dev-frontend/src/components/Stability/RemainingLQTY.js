import { Flex } from "theme-ui";

import { useLiquitySelector } from "@liquity/lib-react";

const selector = ({ remainingStabilityPoolLQTYReward }) => ({
  remainingStabilityPoolLQTYReward
});

export const RemainingLQTY = () => {
  const { remainingStabilityPoolLQTYReward } = useLiquitySelector(selector);

  return (
    <Flex sx={{ mr: 2, fontSize: 2, fontWeight: "medium" }}>
      {remainingStabilityPoolLQTYReward.prettify(0)} LQTY remaining
    </Flex>
  );
};
