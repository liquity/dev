import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useFarmView } from "../context/FarmViewContext";

const transactionId = "farm-unstake-and-claim";

export const UnstakeAndClaim: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={liquity.exitLiquidityMining.bind(liquity)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline" sx={{ mt: 3, width: "100%" }}>
        Unstake and claim reward
      </Button>
    </Transaction>
  );
};
