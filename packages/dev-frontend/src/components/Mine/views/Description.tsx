import React from "react";
import { Text } from "theme-ui";
import { useLiquity } from "../../../hooks/LiquityContext";
import { LP } from "../../../strings";
import { Transaction } from "../../Transaction";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { ActionDescription } from "../../ActionDescription";
import { useLiquitySelector } from "@liquity/lib-react";
import { useValidationState } from "../context/useValidationState";

type DescriptionProps = {
  amount: Decimal;
};

const transactionId = "mine-adjust";
const selector = ({ liquidityMiningStake }: LiquityStoreState) => ({
  liquidityMiningStake
});

export const Description: React.FC<DescriptionProps> = ({ amount }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const { hasApproved, hasEnoughUniToken } = useValidationState(amount);
  const { liquidityMiningStake } = useLiquitySelector(selector);
  const isWithdrawing = amount.lt(liquidityMiningStake);
  const amountChanged = isWithdrawing
    ? liquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(liquidityMiningStake);

  if (!hasApproved || !hasEnoughUniToken) return null;

  return (
    <ActionDescription>
      {isWithdrawing && (
        <Transaction id={transactionId} send={liquity.unstakeUniTokens.bind(liquity, amountChanged)}>
          <Text>{`You are unstaking ${amountChanged.prettify(4)} ${LP}`}</Text>
        </Transaction>
      )}
      {!isWithdrawing && (
        <Transaction id={transactionId} send={liquity.stakeUniTokens.bind(liquity, amountChanged)}>
          <Text>{`You are staking ${amountChanged.prettify(4)} ${LP}`}</Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
