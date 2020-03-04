import React from "react";
import { Text } from "rimble-ui";
import { BigNumber } from "ethers/utils";

import { Pool } from "@liquity/lib";
import { Decimal, Decimalish } from "@liquity/lib/dist/utils";

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimalish;
  pool: Pool;
};

export const SystemStats: React.FC<SystemStatsProps> = ({ numberOfTroves, price, pool }) => {
  return (
    <>
      <Text>Total number of Liquity Troves: {numberOfTroves.toString()}</Text>
      <Text>Price of ETH: ${price.toString(2)}</Text>
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
    </>
  );
};
