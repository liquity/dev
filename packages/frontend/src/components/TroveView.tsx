import React from "react";
import { Text, Heading } from "rimble-ui";

import { Trove } from "@liquity/lib";
import { Decimalish } from "@liquity/lib/dist/utils";

type TroveViewProps = {
  trove?: Trove;
  price: Decimalish;
};

export const TroveView: React.FC<TroveViewProps> = ({ trove, price }) => {
  if (!trove) {
    return <Text fontSize={5}>You don't have a Liquity Trove yet</Text>;
  }

  const collateralRatio = trove.collateralRatioAt(price);
  const collateralRatioAfterRewards = trove.collateralRatioAfterRewardsAt(price);

  const collateralRatioPct = collateralRatio.isInfinite()
    ? collateralRatio
    : collateralRatio.mul(100);

  const collateralRatioPctAfterRewards = collateralRatioAfterRewards.isInfinite()
    ? collateralRatioAfterRewards
    : collateralRatioAfterRewards.mul(100);

  const collateralRatioPctDifference = collateralRatioPct.gt(collateralRatioPctAfterRewards)
    ? "-" + collateralRatioPct.sub(collateralRatioPctAfterRewards).toString(2)
    : "+" + collateralRatioPctAfterRewards.sub(collateralRatioPct).toString(2);

  return (
    <>
      <Heading>Your Liquity Trove</Heading>
      <Text fontSize={4}>
        Collateral: {trove.collateral.toString(2)} ETH
        {!trove.pendingCollateralReward.isZero() && (
          <Text.span color="success" fontSize={4}>
            {" "}
            (+{trove.pendingCollateralReward.toString(2)} ETH pending)
          </Text.span>
        )}
      </Text>
      <Text fontSize={4}>
        Debt: {trove.debt.toString(2)} QUI
        {!trove.pendingDebtReward.isZero() && (
          <Text.span color="warning" fontSize={4}>
            {" "}
            (+{trove.pendingDebtReward.toString(2)} QUI pending)
          </Text.span>
        )}
      </Text>
      <Text fontSize={4}>
        Collateral ratio:{" "}
        <Text.span
          color={
            collateralRatioPct.gt(150)
              ? "success"
              : collateralRatioPct.gt(110)
              ? "warning"
              : "danger"
          }
          fontSize={4}
        >
          {collateralRatioPct.isInfinite() ? "∞" : collateralRatioPct.toString(2) + "%"}
        </Text.span>
        {collateralRatioPctDifference !== "+0.00" && collateralRatioPctDifference !== "-0.00" && (
          <Text.span
            color={collateralRatioPctAfterRewards.gt(collateralRatioPct) ? "success" : "warning"}
            fontSize={4}
          >
            {" "}
            ({collateralRatioPctDifference}% pending)
          </Text.span>
        )}
      </Text>
    </>
  );
};
