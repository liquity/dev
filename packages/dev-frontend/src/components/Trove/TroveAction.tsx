import React, { useEffect } from "react";
import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useMyTransactionState, useTransactionFunction } from "../Transaction";
import { useTroveView } from "./context/TroveViewContext";

type TroveActionProps = {
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
  dispatch: (action: { type: "startChange" | "finishChange" }) => void;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  change,
  maxBorrowingRate,
  dispatch
}) => {
  const { liquity } = useLiquity();

  const myTransactionId = "trove";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const { dispatchEvent } = useTroveView();

  const [sendTransaction] = useTransactionFunction(
    myTransactionId,
    change.type === "creation"
      ? liquity.send.openTrove.bind(liquity.send, change.params, maxBorrowingRate)
      : change.type === "closure"
      ? liquity.send.closeTrove.bind(liquity.send)
      : liquity.send.adjustTrove.bind(liquity.send, change.params, maxBorrowingRate)
  );

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      dispatch({ type: "startChange" });
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      dispatch({ type: "finishChange" });
    } else if (myTransactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_ADJUSTED");
    }
  }, [myTransactionState.type, dispatch, dispatchEvent]);

  return <Button onClick={sendTransaction}>{children}</Button>;
};
