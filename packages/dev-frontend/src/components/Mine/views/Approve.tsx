import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useMineView } from "../context/MineViewContext";
import { useLiquitySelector } from "@liquity/lib-react";

type ApproveProps = {
  amount: Decimal;
};

const transactionId = "mine-approve";
const selector = ({ uniTokenAllowance }: LiquityStoreState) => ({
  uniTokenAllowance
});

export const Approve: React.FC<ApproveProps> = ({ amount }) => {
  const { dispatchEvent } = useMineView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const { uniTokenAllowance } = useLiquitySelector(selector);

  const hasApprovedEnoughUniTokens = !uniTokenAllowance.isZero && uniTokenAllowance.gte(amount);

  const shouldHide = amount.isZero || hasApprovedEnoughUniTokens;
  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_APPROVED");
    }
  }, [transactionState.type, dispatchEvent]);

  if (shouldHide) {
    return null;
  }

  return (
    <Transaction
      id={transactionId}
      send={liquity.approveUniTokens.bind(liquity, undefined)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button sx={{ width: "60%" }}>Approve UNI LP</Button>
    </Transaction>
  );
};
