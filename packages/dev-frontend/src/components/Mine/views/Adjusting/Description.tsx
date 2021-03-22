import React from "react";
import { Text } from "theme-ui";

import { useLiquity } from "../../../../hooks/LiquityContext";
import { LP } from "../../../../strings";
import { Transaction } from "../../../Transaction";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { ActionDescription } from "../../../ActionDescription";

type DescriptionProps = {
  amountChanged: Decimal;
  isWithdrawing: boolean;
};

const selector = ({ uniTokenBalance, liquidityMiningStake }: LiquityStoreState) => ({
  uniTokenBalance,
  liquidityMiningStake
});

const transactionId = "mine-adjust";

export const Description: React.FC<DescriptionProps> = ({ amountChanged, isWithdrawing }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const { uniTokenBalance } = useLiquitySelector(selector);

  return (
    <ActionDescription>
      {isWithdrawing && (
        <Transaction id={transactionId} send={liquity.unstakeUniTokens.bind(liquity, amountChanged)}>
          <Text>{`You are unstaking ${amountChanged.prettify(4)} ${LP}`}</Text>
        </Transaction>
      )}
      {!isWithdrawing && (
        <Transaction
          id={transactionId}
          send={liquity.stakeUniTokens.bind(liquity, amountChanged)}
          requires={[[uniTokenBalance.gte(amountChanged), `You don't have enough ${LP}`]]}
        >
          <Text>{`You are staking +${amountChanged.prettify(4)} ${LP}`}</Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
