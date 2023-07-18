import React from "react";
import { Button } from "theme-ui";

import { useStabilio } from "../../../hooks/StabilioContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimRewardsProps = {
  disabled?: boolean;
};

export const ClaimRewards: React.FC<ClaimRewardsProps> = ({ disabled, children }) => {
  const { stabilio } = useStabilio();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    stabilio.send.withdrawGainsFromStabilityPool.bind(stabilio.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={disabled}>
      {children}
    </Button>
  );
};
