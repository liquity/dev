import { Button } from "theme-ui";

import { Decimal } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type RedemptionActionProps = {
  transactionId: string;
  disabled?: boolean;
  xbrlAmount: Decimal;
  maxRedemptionRate: Decimal;
};

export const RedemptionAction: React.FC<RedemptionActionProps> = ({
  transactionId,
  disabled,
  xbrlAmount,
  maxRedemptionRate
}) => {
  const {
    liquity: { send: liquity }
  } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    liquity.redeemXBRL.bind(liquity, xbrlAmount, maxRedemptionRate)
  );

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
