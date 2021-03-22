import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { useMineView } from "../../context/MineViewContext";

type ConfirmProps = {
  amount: Decimal;
  isDisabled: boolean;
};

const transactionId = "mine-stake";

export const Confirm: React.FC<ConfirmProps> = ({ amount, isDisabled }) => {
  const { dispatchEvent } = useMineView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const shouldDisable = amount.isZero || isDisabled;
  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Transaction
      id={transactionId}
      send={liquity.stakeUniTokens.bind(liquity, amount)}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button disabled={shouldDisable}>Confirm</Button>
    </Transaction>
  );
};
