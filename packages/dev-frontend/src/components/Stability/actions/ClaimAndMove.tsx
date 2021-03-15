import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useStabilityView } from "../context/StabilityViewContext";

export const ClaimAndMove: React.FC = ({ children }) => {
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

  const claimRewardAndMoveGain = liquity.transferCollateralGainToTrove.bind(liquity);

  return (
    <Transaction
      id={transactionId}
      send={claimRewardAndMoveGain}
      failureDisplayType="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline" sx={{ mt: 3, width: "100%" }}>
        {children}
      </Button>
    </Transaction>
  );
};
