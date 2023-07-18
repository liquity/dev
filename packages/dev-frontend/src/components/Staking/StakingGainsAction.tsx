import { Button } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

import { useStabilio } from "../../hooks/StabilioContext";
import { useTransactionFunction } from "../Transaction";

const selectSTBLStake = ({ stblStake }: StabilioStoreState) => stblStake;

export const StakingGainsAction: React.FC = () => {
  const { stabilio } = useStabilio();
  const { collateralGain, xbrlGain } = useStabilioSelector(selectSTBLStake);

  const [sendTransaction] = useTransactionFunction(
    "stake",
    stabilio.send.withdrawGainsFromStaking.bind(stabilio.send)
  );

  return (
    <Button onClick={sendTransaction} disabled={collateralGain.isZero && xbrlGain.isZero}>
      Claim gains
    </Button>
  );
};
