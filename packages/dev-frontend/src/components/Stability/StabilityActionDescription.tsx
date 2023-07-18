import React from "react";

import { Decimal, StabilityDeposit, StabilityDepositChange } from "@stabilio/lib-base";

import { COIN, GT } from "../../strings";
import { ActionDescription, Amount } from "../ActionDescription";

type StabilityActionDescriptionProps = {
  originalDeposit: StabilityDeposit;
  change: StabilityDepositChange<Decimal>;
};

export const StabilityActionDescription: React.FC<StabilityActionDescriptionProps> = ({
  originalDeposit,
  change
}) => {
  const collateralGain = originalDeposit.collateralGain.nonZero?.prettify(4).concat(" ETH");
  const stblReward = originalDeposit.stblReward.nonZero?.prettify().concat(" ", GT);

  return (
    <ActionDescription>
      {change.depositXBRL ? (
        <>
          You are depositing{" "}
          <Amount>
            {change.depositXBRL.prettify()} {COIN}
          </Amount>{" "}
          in the Stability Pool
        </>
      ) : (
        <>
          You are withdrawing{" "}
          <Amount>
            {change.withdrawXBRL.prettify()} {COIN}
          </Amount>{" "}
          to your wallet
        </>
      )}
      {(collateralGain || stblReward) && (
        <>
          {" "}
          and claiming at least{" "}
          {collateralGain && stblReward ? (
            <>
              <Amount>{collateralGain}</Amount> and <Amount>{stblReward}</Amount>
            </>
          ) : (
            <Amount>{collateralGain ?? stblReward}</Amount>
          )}
        </>
      )}
      .
    </ActionDescription>
  );
};
