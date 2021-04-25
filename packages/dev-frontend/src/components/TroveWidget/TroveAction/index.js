import { Button } from "theme-ui";

import { useLiquity } from "../../../hooks/LiquityContext";
import { useTransactionFunction } from "../../Transaction";

const TroveAction = ({ children, transactionId, change, maxBorrowingRate }) => {
  const { liquity } = useLiquity();

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

export default TroveAction;
