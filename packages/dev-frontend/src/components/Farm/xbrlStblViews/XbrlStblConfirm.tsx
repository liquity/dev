import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@stabilio/lib-base";
import { useStabilio } from "../../../hooks/StabilioContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useXbrlStblValidationState } from "../context/useXbrlStblValidationState";
import { useXbrlStblFarmView } from "../context/XbrlStblFarmViewContext";

type XbrlStblConfirmProps = {
  amount: Decimal;
};

const transactionId = "farm-confirm";

export const XbrlStblConfirm: React.FC<XbrlStblConfirmProps> = ({ amount }) => {
  const { dispatchEvent } = useXbrlStblFarmView();
  const {
    stabilio: { send: stabilio }
  } = useStabilio();

  const transactionState = useMyTransactionState(transactionId);
  const { isValid, isWithdrawing, amountChanged } = useXbrlStblValidationState(amount);

  const transactionAction = isWithdrawing
    ? stabilio.unstakeXbrlStblUniTokens.bind(stabilio, amountChanged)
    : stabilio.stakeXbrlStblUniTokens.bind(stabilio, amountChanged);

  const shouldDisable = amountChanged.isZero || !isValid;

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={transactionAction}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button disabled={shouldDisable}>Confirm</Button>
    </Transaction>
  );
};
