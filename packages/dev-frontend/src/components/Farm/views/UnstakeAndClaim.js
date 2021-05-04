import { useEffect } from "react";

import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useFarmView } from "../context/FarmViewContext";
import Button from "../../Button";

const transactionId = "farm-unstake-and-claim";

export const UnstakeAndClaim = ({ hasStakeAndRewards }) => {
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
      <Button large primary disabled={!hasStakeAndRewards}>
        Unstake and claim reward
      </Button>
    </Transaction>
  );
};
