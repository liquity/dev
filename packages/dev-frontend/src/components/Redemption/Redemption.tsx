import { BlockPolledStabilioStoreState } from "@stabilio/lib-ethers";
import { useStabilioSelector } from "@stabilio/lib-react";

import { useStabilio } from "../../hooks/StabilioContext";
import { DisabledRedemption } from "./DisabledRedemption";
import { RedemptionManager } from "./RedemptionManager";

const SECONDS_IN_ONE_DAY = 24 * 60 * 60;

const selectBlockTimestamp = ({ blockTimestamp }: BlockPolledStabilioStoreState) => blockTimestamp;

export const Redemption: React.FC = () => {
  const {
    stabilio: {
      connection: { deploymentDate, bootstrapPeriod }
    }
  } = useStabilio();

  const blockTimestamp = useStabilioSelector(selectBlockTimestamp);

  const bootstrapPeriodDays = Math.round(bootstrapPeriod / SECONDS_IN_ONE_DAY);
  const deploymentTime = deploymentDate.getTime() / 1000;
  const bootstrapEndTime = deploymentTime + bootstrapPeriod;
  const bootstrapEndDate = new Date(bootstrapEndTime * 1000);
  const redemptionDisabled = blockTimestamp < bootstrapEndTime;

  if (redemptionDisabled) {
    return <DisabledRedemption disabledDays={bootstrapPeriodDays} unlockDate={bootstrapEndDate} />;
  }

  return <RedemptionManager />;
};
