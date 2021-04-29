import { useLiquity } from "../../../hooks/LiquityContext";
import { useTransactionFunction } from "../../Transaction";
import Button from "../../Button";

const ClaimAndMove = ({ disabled }) => {
  const { liquity } = useLiquity();

  const [sendTransaction] = useTransactionFunction(
    "stability-deposit",
    liquity.send.transferCollateralGainToTrove.bind(liquity.send)
  );

  return (
    <Button primary large onClick={sendTransaction} disabled={disabled}>
      Claim LQTY and move ETH to trove
    </Button>
  );
};

export default ClaimAndMove;
