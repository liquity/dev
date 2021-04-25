import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../../hooks/LiquityContext";
import { DisabledRedemption } from "./DisabledRedemption";
import RedemptionManager from "./RedemptionManager";

const SECONDS_IN_ONE_DAY = 24 * 60 * 60;

const selectBlockTimestamp = ({ blockTimestamp }) => blockTimestamp;

const Redemption = () => {
  const {
    liquity: {
      connection: { deploymentDate, bootstrapPeriod }
    }
  } = useLiquity();

  const blockTimestamp = useLiquitySelector(selectBlockTimestamp);

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

export default Redemption;
