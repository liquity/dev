import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@stabilio/lib-base";
import { useStabilio } from "../../../hooks/StabilioContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useXbrlStblFarmView } from "../context/XbrlStblFarmViewContext";
import { useXbrlStblValidationState } from "../context/useXbrlStblValidationState";

type ApproveProps = {
  amount: Decimal;
};

const transactionId = "farm-approve";

export const XbrlStblApprove: React.FC<ApproveProps> = ({ amount }) => {
  const { dispatchEvent } = useXbrlStblFarmView();
  const {
    stabilio: { send: stabilio }
  } = useStabilio();

  const { hasApproved } = useXbrlStblValidationState(amount);
  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_APPROVED");
    }
  }, [transactionState.type, dispatchEvent]);

  if (hasApproved) {
    return null;
  }

  return (
    <Transaction
      id={transactionId}
      send={stabilio.approveXbrlStblUniTokens.bind(stabilio, undefined)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button>Approve STBL/xBRL UNI LP</Button>
    </Transaction>
  );
};
