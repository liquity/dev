import { Button } from "theme-ui";

import { Decimal, STBLStakeChange } from "@stabilio/lib-base";

import { useStabilio } from "../../hooks/StabilioContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: STBLStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { stabilio } = useStabilio();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeSTBL
      ? stabilio.send.stakeSTBL.bind(stabilio.send, change.stakeSTBL)
      : stabilio.send.unstakeSTBL.bind(stabilio.send, change.unstakeSTBL)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
