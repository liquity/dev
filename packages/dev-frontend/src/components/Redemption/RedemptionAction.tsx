import React, { useEffect } from "react";
import { Button } from "theme-ui";

import { Decimal, Percent, LiquityStoreState, MINIMUM_COLLATERAL_RATIO } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { COIN } from "../../strings";

import { Transaction, useMyTransactionState } from "../Transaction";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);

type RedemptionActionProps = {
  lusdAmount: Decimal;
  setLUSDAmount: (lusdAmount: Decimal) => void;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  maxRedemptionRate: Decimal;
};

const select = ({ lusdBalance, total, price }: LiquityStoreState) => ({
  lusdBalance,
  total,
  price
});

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  lusdAmount,
  setLUSDAmount,
  changePending,
  setChangePending,
  maxRedemptionRate
}) => {
  const { lusdBalance, total, price } = useLiquitySelector(select);

  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "redemption";
  const myTransactionState = useMyTransactionState(myTransactionId);

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

  if (lusdAmount.isZero || changePending) {
    return <Button disabled>Confirm</Button>;
  }

  const send = liquity.redeemLUSD.bind(liquity, lusdAmount, maxRedemptionRate);

  return (
    <Transaction
      id={myTransactionId}
      showFailure="asTooltip"
      tooltipPlacement="bottom"
      requires={[
        [
          !total.collateralRatioIsBelowMinimum(price),
          `Can't redeem when total collateral ratio is less than ${mcrPercent}`
        ],
        [lusdBalance.gte(lusdAmount), `You don't have enough ${COIN}`]
      ]}
      {...{ send }}
    >
      <Button>Confirm</Button>
    </Transaction>
  );
};
