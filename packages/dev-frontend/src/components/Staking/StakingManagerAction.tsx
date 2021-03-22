import { Button } from "theme-ui";

import { Decimal, LQTYStakeChange } from "@liquity/lib-base";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";

type StakingActionProps = {
  change: LQTYStakeChange<Decimal>;
};

export const StakingManagerAction: React.FC<StakingActionProps> = ({ change, children }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeLQTY
      ? liquity.send.stakeLQTY.bind(liquity.send, change.stakeLQTY)
      : liquity.send.unstakeLQTY.bind(liquity.send, change.unstakeLQTY)
  );

  return <Button onClick={sendTransaction}>{children}</Button>;
};
