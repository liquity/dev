import { Button } from "theme-ui";

import { Decimal, STBLStakeChange } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: STBLStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeSTBL
      ? liquity.send.stakeSTBL.bind(liquity.send, change.stakeSTBL)
      : liquity.send.unstakeSTBL.bind(liquity.send, change.unstakeSTBL)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
