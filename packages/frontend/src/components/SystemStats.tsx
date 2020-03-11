import React from "react";
import { Flex, Text } from "rimble-ui";
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

  return (
    <Flex flexDirection="column" alignItems="center">
      <Text>Price of ETH: ${price.prettify()}</Text>
      <Text>Total number of Liquity Troves: {Decimal.prettify(numberOfTroves)}</Text>
      <Text>QUI in circulation: {pool.totalDebt.shorten()}</Text>
      {quiInStabilityPoolPct && (
        <Text>Fraction of QUI in Stability Pool: {quiInStabilityPoolPct.toString(1)}</Text>
      )}
      <Text>
        Total collateral ratio:{" "}
        {pool
          .totalCollateralRatioAt(price)
          .mul(100)
          .toString(1)}
        %
      </Text>
      {pool.isRecoveryModeActiveAt(price) && (
        <Text color="danger">The system is in recovery mode!</Text>
      )}
    </Flex>
  );
};
