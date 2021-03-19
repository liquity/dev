import React from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../../hooks/LiquityContext";
// import { Transaction } from "../../Transaction";

type ConfirmButtonProps = {
  amount: string;
  isDisabled: boolean;
};

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({ amount, isDisabled }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionId = "mine-deposit";
  const shouldDisable = amount === "0" || isDisabled;

  return (
    // <Transaction
    //   id={transactionId}
    //   send={liquity.depositLPIntoMiningPool.bind(liquity, amount)}
    //   showFailure="asTooltip"
    //   tooltipPlacement="bottom"
    // >
    <Button disabled={shouldDisable}>Confirm</Button>
    // </Transaction>
  );
};
