import React from "react";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

export const StabilityActionDescription = ({ originalDeposit, change }) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const lqtyReward = originalDeposit.lqtyReward.nonZero?.prettify().concat(" ", GT);

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
            {change.withdrawLUSD.prettify()} {COIN}
          </Amount>{" "}
          to your wallet
        </>
      )}
      {(collateralGain || lqtyReward) && (
        <>
          {" "}
          and claiming at least{" "}
          {collateralGain && lqtyReward ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{lqtyReward}</Amount>
            </>
          ) : (
            <Amount>{collateralGain ?? lqtyReward}</Amount>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};
