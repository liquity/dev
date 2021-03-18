import React from "react";
import { Text, Flex } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP } from "../../../../strings";
import { Transaction, useMyTransactionState } from "../../../Transaction";
import { Icon } from "../../../Icon";
import { useLiquitySelector } from "@liquity/lib-react";

type ActionDescriptionProps = {
  amount: string;
};

const selector = ({ lpBalance }: LiquityStoreState) => ({ lpBalance });

export const ActionDescription: React.FC<ActionDescriptionProps> = ({ amount }) => {
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
    <Flex variant="layout.infoMessage">
      <Icon
        style={{ marginRight: "2px", display: "flex", alignItems: "center" }}
        name="info-circle"
      />

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
    </Flex>
  );
};
