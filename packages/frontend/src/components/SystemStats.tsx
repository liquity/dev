import React from "react";
import { Card, Text, Heading } from "rimble-ui";
import { BigNumber } from "ethers/utils";

import { Pool } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimal;
  pool: Pool;
  quiInStabilityPool: Decimal;
};

export const SystemStats: React.FC<SystemStatsProps> = ({
  numberOfTroves,
  price,
  pool,
  quiInStabilityPool
}) => {
  const quiInStabilityPoolPct =
    pool.totalDebt.nonZero && new Percent(quiInStabilityPool.div(pool.totalDebt));
  const totalCollateralRatioPct = new Percent(pool.totalCollateralRatioAt(price));

  return (
    <Card mt={4} p={3} bg="lavender">
      <Heading as="h3" mb={2}>
        System
      </Heading>
      <Text>Price of ETH: ${price.prettify()}</Text>
      <Text>Total number of Liquity Troves: {Decimal.prettify(numberOfTroves)}</Text>
      <Text>QUI in circulation: {pool.totalDebt.shorten()}</Text>
      {quiInStabilityPoolPct && (
        <Text>Fraction of QUI in Stability Pool: {quiInStabilityPoolPct.toString(1)}</Text>
      )}
      <Text>Total collateral ratio: {totalCollateralRatioPct.prettify()}</Text>
      {pool.isRecoveryModeActiveAt(price) && (
        <Text color="danger">The system is in recovery mode!</Text>
      )}
    </Card>
  );
};
