import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useStabilityView } from "../context/StabilityViewContext";

export const ClaimRewards: React.FC = ({ children }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const transactionId = "stability-deposit";
  const transaction = useMyTransactionState(transactionId);
  const { dispatchEvent } = useStabilityView();
  const currentTransactionId = transaction.type !== "idle" ? transaction.id : null;

  useEffect(() => {
    if (transaction.type === "confirmedOneShot" && currentTransactionId === transactionId) {
      dispatchEvent("REWARDS_CLAIMED");
    }
  }, [transaction.type, currentTransactionId, dispatchEvent]);

  const claimRewards = liquity.withdrawGainsFromStabilityPool.bind(liquity);

  return (
    <Transaction
      id={transactionId}
      send={claimRewards}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline">{children}</Button>
    </Transaction>
  );
};
