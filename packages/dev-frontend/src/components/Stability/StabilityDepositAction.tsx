import { Button } from "theme-ui";
import { Decimal, StabilioStoreState, StabilityDepositChange } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

import { useStabilio } from "../../hooks/StabilioContext";
import { useTransactionFunction } from "../Transaction";

type StabilityDepositActionProps = {
  transactionId: string;
  change: StabilityDepositChange<Decimal>;
};

const selectFrontendRegistered = ({ frontend }: StabilioStoreState) =>
  frontend.status === "registered";

export const StabilityDepositAction: React.FC<StabilityDepositActionProps> = ({
  children,
  transactionId,
  change
}) => {
  const { config, stabilio } = useStabilio();
  const frontendRegistered = useStabilioSelector(selectFrontendRegistered);

  const frontendTag = frontendRegistered ? config.frontendTag : undefined;

  const [sendTransaction] = useTransactionFunction(
    transactionId,
    change.depositXBRL
      ? stabilio.send.depositXBRLInStabilityPool.bind(stabilio.send, change.depositXBRL, frontendTag)
      : stabilio.send.withdrawXBRLFromStabilityPool.bind(stabilio.send, change.withdrawXBRL)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
