import React, { useEffect } from "react";
import { Button } from "theme-ui";

import { Decimal } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useMyTransactionState, useTransactionFunction } from "../Transaction";

type RedemptionActionProps = {
  disabled?: boolean;
  lusdAmount: Decimal;
  setLUSDAmount: (lusdAmount: Decimal) => void;
  setChangePending: (isPending: boolean) => void;
  maxRedemptionRate: Decimal;
};

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  disabled,
  lusdAmount,
  setLUSDAmount,
  setChangePending,
  maxRedemptionRate
}) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "redemption";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const [sendTransaction] = useTransactionFunction(
    myTransactionId,
    liquity.redeemLUSD.bind(liquity, lusdAmount, maxRedemptionRate)
  );

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (myTransactionState.type === "confirmed") {
      setLUSDAmount(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setLUSDAmount]);

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
