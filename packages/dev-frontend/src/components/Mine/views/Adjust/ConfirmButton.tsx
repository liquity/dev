import React from "react";
import { Button } from "theme-ui";
import { useLiquity } from "../../../../hooks/LiquityContext";
// import { Transaction } from "../../Transaction";

type ConfirmButtonProps = {
  amount: string;
};

export const ConfirmButton: React.FC<ConfirmButtonProps> = ({ amount }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const transactionId = "mine-adjust";
  const isDisabled = amount === "0";

  return (
    // <Transaction
    //   id={transactionId}
    //   send={liquity.depositLPIntoMiningPool.bind(liquity, amount)}
    //   showFailure="asTooltip"
    //   tooltipPlacement="bottom"
    // >
    <Button disabled={isDisabled}>Confirm</Button>
    // </Transaction>
  );
};
