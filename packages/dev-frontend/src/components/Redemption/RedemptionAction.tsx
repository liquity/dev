import { Button } from "theme-ui";

import { Decimal } from "@stabilio/lib-base";

import { useStabilio } from "../../hooks/StabilioContext";
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
    stabilio: { send: stabilio }
  } = useStabilio();

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    stabilio.redeemXBRL.bind(stabilio, xbrlAmount, maxRedemptionRate)
  );

  return (
    <Button disabled={disabled} onClick={sendTransaction}>
      Confirm
    </Button>
  );
};
