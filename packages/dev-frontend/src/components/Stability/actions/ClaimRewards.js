import { useLiquity } from "../../../hooks/LiquityContext";
import { useTransactionFunction } from "../../Transaction";
import Button from "../../Button";

const ClaimRewards = ({ disabled }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    liquity.send.withdrawGainsFromStabilityPool.bind(liquity.send)
  );

  return (
    <Button primary large onClick={sendTransaction} disabled={disabled}>
      Claim LQTY and ETH
    </Button>
  );
};

export default ClaimRewards;
