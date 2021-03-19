import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useMineView } from "../../context/MineViewContext";

const transactionId = "mine-unstake-and-claim";
const selector = ({ liquidityMiningStake }: LiquityStoreState) => ({ liquidityMiningStake });

export const UnstakeAndClaim: React.FC = () => {
  const { dispatchEvent } = useMineView();
  const { liquidityMiningStake } = useLiquitySelector(selector);

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
      send={liquity.unstakeUniTokens.bind(liquity, liquidityMiningStake)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button variant="outline" sx={{ mt: 3, ml: 2, width: "100%" }}>
        Unstake and claim reward
      </Button>
    </Transaction>
  );
};
