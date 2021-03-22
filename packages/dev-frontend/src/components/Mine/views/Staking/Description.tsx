import React from "react";
import { Text } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP } from "../../../../strings";
import { Transaction } from "../../../Transaction";
import { ActionDescription } from "../../../ActionDescription";

type DescriptionProps = {
  amount: Decimal;
  uniTokenBalance: Decimal;
};

const transactionId = "mine-stake";

export const Description: React.FC<DescriptionProps> = ({ amount, uniTokenBalance }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  return (
    <ActionDescription>
      {
        <Transaction
          id={transactionId}
          send={liquity.stakeUniTokens.bind(liquity, amount)}
          requires={[[uniTokenBalance.gte(amount), `You don't have enough ${LP}`]]}
        >
          <Text>
            You are staking {amount.prettify(4)} {LP}
          </Text>
        </Transaction>
      }
    </ActionDescription>
  );
};
