import React from "react";
import { Flex, Text } from "rimble-ui";
import { BigNumber } from "ethers/utils";

import { Pool } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimal;
  pool: Pool;
};

export const SystemStats: React.FC<SystemStatsProps> = ({ numberOfTroves, price, pool }) => {
  return (
    <Flex flexDirection="column" alignItems="center">
      <Text>Price of ETH: ${price.prettify()}</Text>
      <Text>QUI in circulation: {pool.totalDebt.shorten()}</Text>
      <Text>
        Total collateral ratio:{" "}
        {pool
          .totalCollateralRatioAt(price)
          .mul(100)
          .toString(1)}
        %
      </Text>
      <Text>Total number of Liquity Troves: {Decimal.shorten(numberOfTroves)}</Text>
      {pool.isRecoveryModeActiveAt(price) && (
        <Text color="danger">The system is in recovery mode!</Text>
      )}
    </Flex>
  );
};
