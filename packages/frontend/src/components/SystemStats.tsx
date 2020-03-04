import React from "react";
import { Text } from "rimble-ui";

import { Decimalish } from "@liquity/lib/dist/utils";
import { BigNumber } from "ethers/utils";

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimalish;
  recoveryModeActive: boolean;
};

export const SystemStats: React.FC<SystemStatsProps> = ({
  numberOfTroves,
  price,
  recoveryModeActive
}) => {
  return (
    <>
      <Text>Total number of Liquity Troves: {numberOfTroves.toString()}</Text>
      <Text>Price of ETH: ${price.toString(2)}</Text>
      {recoveryModeActive && <Text intent="danger">The system is in recovery mode!</Text>}
    </>
  );
};
