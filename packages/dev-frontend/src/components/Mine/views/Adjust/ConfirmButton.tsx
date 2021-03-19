import React from "react";
import { Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { Transaction } from "../../../Transaction";

type ConfirmButtonProps = {
  amountChanged: Decimal;
  isWithdrawing: boolean;
};

const transactionId = "mine-adjust";

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({ amountChanged, isWithdrawing }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionAction = isWithdrawing
    ? liquity.unstakeUniTokens.bind(liquity, amountChanged)
    : liquity.stakeUniTokens.bind(liquity, amountChanged);

  const isDirty = !amountChanged.isZero;

  return (
    <Transaction
      id={transactionId}
      send={transactionAction}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
    >
      <Button disabled={isDirty}>Confirm</Button>
    </Transaction>
  );
};
