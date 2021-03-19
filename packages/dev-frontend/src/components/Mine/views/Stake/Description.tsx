import React from "react";
import { Text } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP } from "../../../../strings";
import { Transaction } from "../../../Transaction";
import { useLiquitySelector } from "@liquity/lib-react";
import { ActionDescription } from "../../../ActionDescription";

type DescriptionProps = {
  amount: Decimal;
};

const transactionId = "mine-stake";
const selector = ({ uniTokenBalance }: LiquityStoreState) => ({ uniTokenBalance });

export const Description: React.FC<DescriptionProps> = ({ amount }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const { uniTokenBalance } = useLiquitySelector(selector);

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
