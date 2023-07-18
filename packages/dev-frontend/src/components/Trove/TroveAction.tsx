import { Button } from "theme-ui";

import { Decimal, TroveChange } from "@stabilio/lib-base";

import { useStabilio } from "../../hooks/StabilioContext";
import { useTransactionFunction } from "../Transaction";

type TroveActionProps = {
  transactionId: string;
  change: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }>;
  maxBorrowingRate: Decimal;
  borrowingFeeDecayToleranceMinutes: number;
};

export const TroveAction: React.FC<TroveActionProps> = ({
  children,
  transactionId,
  change,
  maxBorrowingRate,
  borrowingFeeDecayToleranceMinutes
}) => {
  const { stabilio } = useStabilio();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? stabilio.send.openTrove.bind(stabilio.send, change.params, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
      : change.type === "closure"
      ? stabilio.send.closeTrove.bind(stabilio.send)
      : stabilio.send.adjustTrove.bind(stabilio.send, change.params, {
          maxBorrowingRate,
          borrowingFeeDecayToleranceMinutes
        })
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
