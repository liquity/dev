import React from "react";
import { Card, Text, Heading } from "rimble-ui";
import { BigNumber } from "ethers/utils";

import { Trove } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimal;
  total: Trove;
  quiInStabilityPool: Decimal;
};

export const SystemStats: React.FC<SystemStatsProps> = ({
  numberOfTroves,
  price,
  total,
  quiInStabilityPool
}) => {
  const quiInStabilityPoolPct =
    total.debtAfterReward.nonZero && new Percent(quiInStabilityPool.div(total.debtAfterReward));
  const totalCollateralRatioPct = new Percent(total.collateralRatioAfterRewards(price));

  return (
    <Card mt={4} p={3} bg="lavender">
      <Heading as="h3" mb={2}>
        System
      </Heading>
      <Text>Total number of Liquity Troves: {Decimal.prettify(numberOfTroves)}</Text>
      <Text>QUI in circulation: {total.debtAfterReward.shorten()}</Text>
      {quiInStabilityPoolPct && (
        <Text>Fraction of QUI in Stability Pool: {quiInStabilityPoolPct.toString(1)}</Text>
      )}
      <Text>Total collateral ratio: {totalCollateralRatioPct.prettify()}</Text>
      {total.collateralRatioIsBelowCritical(price) && (
        <Text color="danger">The system is in recovery mode!</Text>
      )}
    </Card>
  );
};
