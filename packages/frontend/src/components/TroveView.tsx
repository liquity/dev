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

  return (
    <>
      <Heading>Your Liquity Trove</Heading>
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
        Collateral ratio:{" "}
        {trove
          .collateralRatioAt(price)
          .mul(100)
          .toString(1)}
        %
        {!trove.pendingCollateralReward.isZero() ||
          (!trove.pendingDebtReward.isZero() && (
            <Text.span>
              (after rewards:{" "}
              {trove
                .collateralRatioAfterRewardsAt(price)
                .mul(100)
                .toString(1)}
              %)
            </Text.span>
          ))}
      </Text>
    </>
  );
};
