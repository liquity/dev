import Button from "../Button";
import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

const RedemptionAction = ({ transactionId, disabled, lusdAmount, maxRedemptionRate }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    liquity.redeemLUSD.bind(liquity, lusdAmount, maxRedemptionRate)
  );

  return (
    <Button primary uppercase large disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};

export default RedemptionAction;
