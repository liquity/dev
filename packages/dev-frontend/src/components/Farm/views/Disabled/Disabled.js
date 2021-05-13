import { useLiquitySelector } from "@liquity/lib-react";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { GT, LP } from "../../../../strings";

import StaticRow from "../../../StaticRow";

import classes from "./Disabled.module.css";

const selector = ({ liquidityMiningStake, liquidityMiningLQTYReward }) => ({
  liquidityMiningStake,
  liquidityMiningLQTYReward
});

export const Disabled = () => {
  const { liquidityMiningStake, liquidityMiningLQTYReward } = useLiquitySelector(selector);
  const hasStake = !liquidityMiningStake.isZero;

  return (
    <>
      {hasStake && (
        <>
          <div className={classes.infos}>
            <StaticRow
              label="Stake"
              inputId="farm-deposit"
              amount={liquidityMiningStake.prettify(4)}
              unit={LP}
            />
            <StaticRow
              label="Reward"
              inputId="farm-reward"
              amount={liquidityMiningLQTYReward.prettify(4)}
              color={liquidityMiningLQTYReward.nonZero && "success"}
              unit={GT}
            />
          </div>

          <div className={classes.actions}>
            <UnstakeAndClaim />
          </div>
        </>
      )}
    </>
  );
};
