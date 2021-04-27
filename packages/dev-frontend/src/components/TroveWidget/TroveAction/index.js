import { useLiquity } from "../../../hooks/LiquityContext";
import { useTransactionFunction } from "../../Transaction";
import Button from "../../Button";

const TroveAction = ({ children, transactionId, change, maxBorrowingRate, ...rest }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.type === "creation"
      ? liquity.send.openTrove.bind(liquity.send, change.params, maxBorrowingRate)
      : change.type === "closure"
      ? liquity.send.closeTrove.bind(liquity.send)
      : liquity.send.adjustTrove.bind(liquity.send, change.params, maxBorrowingRate)
  );

  return (
    <Button onClick={sendTransaction} {...rest}>
      {children}
    </Button>
  );
};

export default TroveAction;
