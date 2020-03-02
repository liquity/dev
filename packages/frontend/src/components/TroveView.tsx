import React from "react";
import { Text, Heading } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { useTroveState } from "../hooks/Liquity";

type TroveViewProps = {
  trove: Trove;
};

export const TroveView: React.FC<TroveViewProps> = ({ trove }) => (
  <>
    <Text fontSize={4}>
      Collateral: {trove.collateral.toString(2)} ETH
      {!trove.pendingCollateralReward.isZero() && (
        <Text.span>(+{trove.pendingCollateralReward.toString(2)} ETH pending)</Text.span>
      )}
    </Text>
    <Text fontSize={4}>
      Debt: {trove.debt.toString(2)} QUI
      {!trove.pendingDebtReward.isZero() && (
        <Text.span>(+{trove.pendingDebtReward.toString(2)} QUI pending)</Text.span>
      )}
    </Text>
    <Text fontSize={4}>
      Collateral ratio: {trove.collateralRatio.mul(100).toString(1)}%
      {!trove.pendingCollateralReward.isZero() ||
        (!trove.pendingDebtReward.isZero() && (
          <Text.span>
            (after rewards: {trove.collateralRatioAfterRewards.mul(100).toString(1)}%)
          </Text.span>
        ))}
    </Text>
  </>
);

type CurrentTroveProps = {
  liquity: Liquity;
};

export const CurrentTrove: React.FC<CurrentTroveProps> = ({ liquity }) => {
  const troveState = useTroveState(liquity);

  if (!troveState.loaded) {
    return <Text>Loading...</Text>;
  }

  const trove = troveState.value;
  if (!trove) {
    return <Text fontSize={5}>You don't have a Liquity Trove yet</Text>;
  }

  return (
    <>
      <Heading>Your Liquity Trove</Heading>
      <TroveView trove={trove} />
    </>
  );
};
