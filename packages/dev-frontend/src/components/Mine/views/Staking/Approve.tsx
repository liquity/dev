import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useMineView } from "../../context/MineViewContext";

type ApproveProps = {
  amount: Decimal;
  isDisabled: boolean;
};

const transactionId = "mine-approve";

export const Approve: React.FC<ApproveProps> = ({ amount, isDisabled }) => {
  const { dispatchEvent } = useMineView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const shouldDisable = amount.isZero || isDisabled;
  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_APPROVED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={liquity.approveUniTokens.bind(liquity, amount)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button disabled={shouldDisable} sx={{ width: "60%" }}>
        Approve UNI LP
      </Button>
    </Transaction>
  );
};
