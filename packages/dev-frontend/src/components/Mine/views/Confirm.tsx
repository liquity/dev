import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Transaction, useMyTransactionState } from "../../Transaction";
import { useLiquitySelector } from "@liquity/lib-react";
import { useValidationState } from "../context/useValidationState";
import { useMineView } from "../context/MineViewContext";

type ConfirmProps = {
  amount: Decimal;
};

const transactionId = "mine-confirm";
const selector = ({ liquidityMiningStake }: LiquityStoreState) => ({
  liquidityMiningStake
});

export const Confirm: React.FC<ConfirmProps> = ({ amount }) => {
  const { dispatchEvent } = useMineView();
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const { liquidityMiningStake } = useLiquitySelector(selector);
  const transactionState = useMyTransactionState(transactionId);

  const isWithdrawing = liquidityMiningStake.gt(amount);

  const amountChanged = isWithdrawing
    ? liquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(liquidityMiningStake);

  const { hasApproved, hasEnoughUniToken } = useValidationState(amountChanged);

  const transactionAction = isWithdrawing
    ? liquity.unstakeUniTokens.bind(liquity, amountChanged)
    : liquity.stakeUniTokens.bind(liquity, amountChanged);

  const shouldDisable = amountChanged.isZero || !hasApproved || !hasEnoughUniToken;

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
