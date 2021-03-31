import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useMyTransactionState, useTransactionFunction } from "../Transaction";
import { useEffect } from "react";
import { useTroveView } from "./context/TroveViewContext";

type TroveActionProps = {
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  maxBorrowingRate
}) => {
  const { liquity } = useLiquity();
  const { dispatchEvent } = useTroveView();

  const transactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      if (change.type === "closure") {
        dispatchEvent("TROVE_CLOSED");
      } else if (change.type === "creation" || change.type === "adjustment") {
        dispatchEvent("TROVE_ADJUSTED");
      }
    }
  }, [transactionState.type, change.type, dispatchEvent]);

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? liquity.send.openTrove.bind(liquity.send, change.params, maxBorrowingRate)
      : change.type === "closure"
      ? liquity.send.closeTrove.bind(liquity.send)
      : liquity.send.adjustTrove.bind(liquity.send, change.params, maxBorrowingRate)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
