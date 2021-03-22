import React from "react";
import { Button } from "theme-ui";

import { useLiquity } from "../../../hooks/LiquityContext";
import { useTransactionFunction } from "../../Transaction";

type ClaimRewardsProps = {
  disabled?: boolean;
};

export const ClaimRewards: React.FC<ClaimRewardsProps> = ({ disabled, children }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    liquity.send.withdrawGainsFromStabilityPool.bind(liquity.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={disabled}>
      {children}
    </Button>
  );
};
