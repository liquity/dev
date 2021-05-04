import { useEffect } from "react";

import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useFarmView } from "../../context/FarmViewContext";
import Button from "../../../Button";

const transactionId = "farm-claim-reward";

export const ClaimReward = ({ liquidityMiningLQTYReward }) => {
  const { dispatchEvent } = useFarmView();

  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("CLAIM_REWARD_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={liquity.withdrawLQTYRewardFromLiquidityMining.bind(liquity)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button large primary disabled={liquidityMiningLQTYReward.isZero}>
        Claim reward
      </Button>
    </Transaction>
  );
};
