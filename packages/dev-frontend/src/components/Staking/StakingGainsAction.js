import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { useTransactionFunction } from "../Transaction";
import Button from "../Button";

const selectLQTYStake = ({ lqtyStake }) => lqtyStake;

export const StakingGainsAction = () => {
  const { liquity } = useLiquity();
  const { collateralGain, lusdGain } = useLiquitySelector(selectLQTYStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    liquity.send.withdrawGainsFromStaking.bind(liquity.send)
  );

  return (
    <Button
      primary
      large
      onClick={sendTransaction}
      disabled={collateralGain.isZero && lusdGain.isZero}
    >
      Claim gains
    </Button>
  );
};

export default StakingGainsAction;
