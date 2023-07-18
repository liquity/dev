import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useStabilio } from "../../../../hooks/StabilioContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useFarmView } from "../../context/FarmViewContext";

const transactionId = "farm-claim-reward";

export const ClaimReward: React.FC = () => {
  const { dispatchEvent } = useFarmView();

  const {
    stabilio: { send: stabilio }
  } = useStabilio();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("CLAIM_REWARD_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={stabilio.withdrawSTBLRewardFromXbrlWethLiquidityMining.bind(stabilio)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button>Claim reward</Button>
    </Transaction>
  );
};
