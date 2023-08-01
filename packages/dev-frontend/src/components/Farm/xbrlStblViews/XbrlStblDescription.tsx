import React from "react";
import { Text } from "theme-ui";
import { useStabilio } from "../../../hooks/StabilioContext";
import { LP } from "../../../strings";
import { Transaction } from "../../Transaction";
import { Decimal } from "@stabilio/lib-base";
import { ActionDescription } from "../../ActionDescription";
import { useXbrlStblValidationState } from "../context/useXbrlStblValidationState";

type XbrlStblDescriptionProps = {
  amount: Decimal;
};

const transactionId = "farm-stake";

export const XbrlStblDescription: React.FC<XbrlStblDescriptionProps> = ({ amount }) => {
  const {
    stabilio: { send: stabilio }
  } = useStabilio();
  const { isValid, hasApproved, isWithdrawing, amountChanged } = useXbrlStblValidationState(amount);

  if (!hasApproved) {
    return (
      <ActionDescription>
        <Text>To stake your STBL/xBRL {LP} tokens you need to allow Stabilio to stake them for you</Text>
      </ActionDescription>
    );
  }

  if (!isValid || amountChanged.isZero) {
    return null;
  }

  return (
    <ActionDescription>
      {isWithdrawing && (
        <Transaction id={transactionId} send={stabilio.unstakeXbrlStblUniTokens.bind(stabilio, amountChanged)}>
          <Text>
            You are unstaking {amountChanged.prettify(4)} STBL/xBRL {LP}
          </Text>
        </Transaction>
      )}
      {!isWithdrawing && (
        <Transaction id={transactionId} send={stabilio.stakeXbrlStblUniTokens.bind(stabilio, amountChanged)}>
          <Text>
            You are staking {amountChanged.prettify(4)} STBL/xBRL {LP}
          </Text>
        </Transaction>
      )}
    </ActionDescription>
  );
};
