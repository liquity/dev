import React from "react";
import { Flex } from "theme-ui";

export const RemainingLQTY: React.FC = () => {
  // if (remainingLQTY === 0) { Sorry the liquidity mining program is finished. There is no more allocated LQTY. }
  return <Flex sx={{ fontSize: 2, mt: 3 }}>3,000,000 LQTY remaining</Flex>;
};
