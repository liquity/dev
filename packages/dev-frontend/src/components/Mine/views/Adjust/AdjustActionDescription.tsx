import React from "react";
import { Text, Flex } from "theme-ui";

import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP, GT } from "../../../../strings";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { Icon } from "../../../Icon";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { ActionDescription } from "../../../ActionDescription";

type AdjustActionDescriptionProps = {
  amount: string;
  shouldClaimReward: boolean;
};

const selector = ({ lpBalance, lpStaked }: LiquityStoreState) => ({ lpBalance, lpStaked });

export const AdjustActionDescription: React.FC<AdjustActionDescriptionProps> = ({
  amount,
  shouldClaimReward
}) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const lpBalance = Decimal.from(100);
  const lpStaked = Decimal.from(10);
  const lpReward = Decimal.from(50);

  // const { lpBalance, lpStaked } = useLiquitySelector(selector);

  const transactionId = "mine-stake";
  const transactionState = useMyTransactionState(transactionId);

  const isDirty = !Decimal.from(amount).eq(lpStaked);
  const isWaitingForApproval =
    transactionState.type === "waitingForApproval" && transactionState.id === transactionId;

  const isWithdrawing = lpStaked.gt(amount);
  const hasReward = true;
  const amountChanged = isWithdrawing ? lpStaked.sub(amount) : Decimal.from(amount).sub(lpStaked);
  const isClaimingRewards = hasReward && shouldClaimReward;

  if (!isDirty) return null;

  return (
    <ActionDescription>
      {isWaitingForApproval && <Text>Waiting for your approval...</Text>}
      {!isWaitingForApproval && isWithdrawing && (
        <Transaction id={transactionId} send={/*TODO*/ liquity.stakeLQTY.bind(liquity, amount)}>
          <Text>
            {isClaimingRewards
              ? `You are unstaking ${amountChanged.prettify(4)} ${LP} and claiming ${lpReward} ${GT}`
              : `You are unstaking ${amountChanged.prettify(4)} ${LP}`}
          </Text>
        </Transaction>
      )}
      {!isWaitingForApproval && !isWithdrawing && (
        <Transaction
          id={transactionId}
          send={/*TODO*/ liquity.stakeLQTY.bind(liquity, amount)}
          requires={[[lpBalance.gte(amount), `You don't have enough ${LP}`]]}
        >
          <Text>
            {isClaimingRewards
              ? `You are staking +${amountChanged.prettify(4)} ${LP} and claiming ${lpReward} ${GT}`
              : `You are staking +${amountChanged.prettify(4)} ${LP}`}
          </Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
