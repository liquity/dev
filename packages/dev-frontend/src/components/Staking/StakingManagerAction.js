import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";
import Button from "../Button";

export const StakingManagerAction = ({ change, whenDone }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stake",
    change.stakeLQTY
      ? liquity.send.stakeLQTY.bind(liquity.send, change.stakeLQTY)
      : liquity.send.unstakeLQTY.bind(liquity.send, change.unstakeLQTY)
  );

  return (
    <Button
      primary
      large
      onClick={async () => {
        await sendTransaction();
        whenDone();
      }}
    >
      Confirm
    </Button>
  );
};

export default StakingManagerAction;
