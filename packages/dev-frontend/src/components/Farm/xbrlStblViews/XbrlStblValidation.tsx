import React from "react";
import { Decimal } from "@stabilio/lib-base";
import { LP } from "../../../strings";
import { ErrorDescription } from "../../ErrorDescription";
import { useXbrlStblValidationState } from "../context/useXbrlStblValidationState";

type ValidationProps = {
  amount: Decimal;
};

export const XbrlStblValidation: React.FC<ValidationProps> = ({ amount }) => {
  const { isValid, hasApproved, hasEnoughUniToken } = useXbrlStblValidationState(amount);

  if (isValid) {
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
