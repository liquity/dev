import React from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { LP } from "../../../strings";
import { ErrorDescription } from "../../ErrorDescription";
import { useValidationState } from "../context/useValidationState";

type ValidationProps = {
  amount: Decimal;
};

const selector = ({ liquidityMiningStake }: LiquityStoreState) => ({ liquidityMiningStake });

export const Validation: React.FC<ValidationProps> = ({ amount }) => {
  const { liquidityMiningStake } = useLiquitySelector(selector);
  const { hasApproved, hasEnoughUniToken } = useValidationState(amount);
  const isWithdrawing = amount.lt(liquidityMiningStake);

  if (isWithdrawing) {
    return null;
  }

  if (!hasApproved) {
    return <ErrorDescription>You haven't approved enough {LP}</ErrorDescription>;
  }

  if (!hasEnoughUniToken) {
    return <ErrorDescription>You don't have enough {LP}</ErrorDescription>;
  }

  return null;
};
