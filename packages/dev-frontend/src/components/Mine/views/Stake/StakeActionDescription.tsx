import React from "react";
import { Text, Flex } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP } from "../../../../strings";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { Icon } from "../../../Icon";
import { useLiquitySelector } from "@liquity/lib-react";
import { ActionDescription } from "../../../ActionDescription";

type StakeActionDescriptionProps = {
  amount: string;
};

const selector = ({ lpBalance }: LiquityStoreState) => ({ lpBalance });

export const StakeActionDescription: React.FC<StakeActionDescriptionProps> = ({ amount }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  // const { lpBalance } = useLiquitySelector(selector);
  const lpBalance = Decimal.from(100);

  const transactionId = "mine-stake";
  const transactionState = useMyTransactionState(transactionId);

  const isDirty = amount !== "0";
  const isWaitingForApproval =
    transactionState.type === "waitingForApproval" && transactionState.id === transactionId;

  if (!isDirty) return null;

  return (
    <ActionDescription>
      {isWaitingForApproval && <Text>Waiting for your approval...</Text>}

      {!isWaitingForApproval && (
        <Transaction
          id={transactionId}
          send={/*TODO*/ liquity.stakeLQTY.bind(liquity, amount)}
          requires={[[lpBalance.gte(amount), `You don't have enough ${LP}`]]}
        >
          <Text>
            You are staking {amount /*.prettify()*/} {LP}
          </Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
