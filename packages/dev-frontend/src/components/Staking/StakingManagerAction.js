import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";
import Button from "../Button";

export const StakingManagerAction = ({ change, children }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeLQTY
      ? liquity.send.stakeLQTY.bind(liquity.send, change.stakeLQTY)
      : liquity.send.unstakeLQTY.bind(liquity.send, change.unstakeLQTY)
  );

  return (
    <Button primary large onClick={sendTransaction}>
      Confirm
    </Button>
  );
};

export default StakingManagerAction;
