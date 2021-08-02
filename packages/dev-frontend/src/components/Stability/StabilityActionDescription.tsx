import React from "react";

import { Decimal, StabilityDeposit, StabilityDepositChange, Difference} from "@liquity/lib-base";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

type StabilityActionDescriptionProps = {
  originalDeposit: StabilityDeposit;
  change: StabilityDepositChange<Decimal>;
  lusdDiff: Difference | undefined
  ethDiff: Difference | undefined
};

export const StabilityActionDescription: React.FC<StabilityActionDescriptionProps> = ({
  originalDeposit,
  change,
  lusdDiff,
  ethDiff,
}) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const lqtyReward = originalDeposit.lqtyReward.nonZero?.prettify().concat(" ", GT);

  let eth = ethDiff?.prettify(4)
  if(eth && (eth.indexOf("-") > -1 || eth.indexOf("+") > -1)){
    eth = eth.substr(1)
  }
  let lusd = lusdDiff?.prettify(2)
  if(lusd && (lusd.indexOf("-") > -1 || lusd.indexOf("+") > -1)){
    lusd = lusd.substr(1)
  }
  return (
    <ActionDescription>
      {change.depositLUSD ? (
        <>
          You are depositing{" "}
          <Amount>
            {change.depositLUSD.prettify()} {COIN}
          </Amount>{" "}
          in the Stability Pool
        </>
      ) : (
        <>
          You are withdrawing{" "}
          <Amount>
            {lusd} LUSD
          </Amount>{" "}
          {ethDiff?.absoluteValue?.gte(1/10000) &&
          <>
            And
            {" "}
            <Amount>
            {eth} ETH
            </Amount>{" "}
          </>
          }
          to your wallet
        </>
      )}
      {lqtyReward && (
        <>
          {" "}
          and claiming at least{" "}
            <Amount>{lqtyReward}</Amount>
        </>
      )}
      .
    </ActionDescription>
  );
};
