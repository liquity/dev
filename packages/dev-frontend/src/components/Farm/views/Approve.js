import { useEffect } from "react";

import Button from "../../Button";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useFarmView } from "../context/FarmViewContext";
import { useValidationState } from "../context/useValidationState";

const transactionId = "farm-approve";

export const Approve = ({ amount }) => {
  const { dispatchEvent } = useFarmView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const { hasApproved } = useValidationState(amount);
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
      send={liquity.approveUniTokens.bind(liquity, undefined)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button large primary>
        Approve UNI LP
      </Button>
    </Transaction>
  );
};
