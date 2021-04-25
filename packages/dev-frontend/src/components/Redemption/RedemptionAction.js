import { Button } from "theme-ui";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

export const RedemptionAction = ({ transactionId, disabled, lusdAmount, maxRedemptionRate }) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    liquity.redeemLUSD.bind(liquity, lusdAmount, maxRedemptionRate)
  );

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
