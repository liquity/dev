import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useStabilio } from "../../../hooks/StabilioContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useXbrlStblFarmView } from "../context/XbrlStblFarmViewContext";

const transactionId = "farm-unstake-and-claim";

export const XbrlStblUnstakeAndClaim: React.FC = () => {
  const { dispatchEvent } = useXbrlStblFarmView();

  const {
    stabilio: { send: stabilio }
  } = useStabilio();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={stabilio.exitXbrlStblLiquidityMining.bind(stabilio)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline" sx={{ mt: 3, width: "100%", ml: 2 }}>
        Unstake and claim reward
      </Button>
    </Transaction>
  );
};
