import React from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction } from "../../../Transaction";

type ConfirmButtonProps = {
  amount: Decimal;
  isDisabled: boolean;
};

const transactionId = "mine-stake";

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({ amount, isDisabled }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const shouldDisable = amount.isZero || isDisabled;

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
