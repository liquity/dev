import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useValidationState } from "../context/useValidationState";
import { useMineView } from "../context/MineViewContext";

type ConfirmProps = {
  amount: Decimal;
};

const transactionId = "mine-confirm";

export const Confirm: React.FC<ConfirmProps> = ({ amount }) => {
  const { dispatchEvent } = useMineView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionState = useMyTransactionState(transactionId);
  const { isValid, isWithdrawing, amountChanged } = useValidationState(amount);

  const transactionAction = isWithdrawing
    ? liquity.unstakeUniTokens.bind(liquity, amountChanged)
    : liquity.stakeUniTokens.bind(liquity, amountChanged);

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
