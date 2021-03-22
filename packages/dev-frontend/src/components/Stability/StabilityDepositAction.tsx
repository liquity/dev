import React, { useEffect } from "react";
import { Button } from "theme-ui";
import { Decimal, LiquityStoreState, StabilityDepositChange } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction, useMyTransactionState } from "../Transaction";
import { useStabilityView } from "./context/StabilityViewContext";

type StabilityDepositActionProps = {
  change: StabilityDepositChange<Decimal>;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

const selectFrontendRegistered = ({ frontend }: LiquityStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  change,
  dispatch
}) => {
  const { dispatchEvent } = useStabilityView();
  const { config, liquity } = useLiquity();
  const frontendRegistered = useLiquitySelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const myTransactionId = "stability-deposit";
  const myTransactionState = useMyTransactionState(myTransactionId);

  const [sendTransaction] = useTransactionFunction(
    myTransactionId,
    change.depositLUSD
      ? liquity.send.depositLUSDInStabilityPool.bind(liquity.send, change.depositLUSD, frontendTag)
      : liquity.send.withdrawLUSDFromStabilityPool.bind(liquity.send, change.withdrawLUSD)
  );

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("DEPOSIT_CONFIRMED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  return <Button onClick={sendTransaction}>{children}</Button>;
};
