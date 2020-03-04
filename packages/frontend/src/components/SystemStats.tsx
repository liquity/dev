import React from "react";
import { Text } from "rimble-ui";
import { BigNumber } from "ethers/utils";

import { calculateCollateralRatio } from "@liquity/lib";
import { Decimal, Decimalish } from "@liquity/lib/dist/utils";

type PoolTotals = {
  activeCollateral: Decimalish;
  activeDebt: Decimalish;
  liquidatedCollateral: Decimalish;
  closedDebt: Decimalish;
};

type SystemStatsProps = {
  numberOfTroves: BigNumber;
  price: Decimalish;
  recoveryModeActive: boolean;
  poolTotals: PoolTotals;
};

const calculateTotalCollateralRatio = (totals: PoolTotals, price: Decimalish) => {
  const totalCollateral = Decimal.from(totals.activeCollateral).add(totals.liquidatedCollateral);
  const totalDebt = Decimal.from(totals.activeDebt).add(totals.closedDebt);

  return calculateCollateralRatio(totalCollateral, totalDebt, price)
    .mul(100)
    .toString(1);
};

export const SystemStats: React.FC<SystemStatsProps> = ({
  numberOfTroves,
  price,
  recoveryModeActive,
  poolTotals
}) => {
  return (
    <>
      <Text>Total number of Liquity Troves: {numberOfTroves.toString()}</Text>
      <Text>Price of ETH: ${price.toString(2)}</Text>
      <Text>Total collateral ratio: {calculateTotalCollateralRatio(poolTotals, price)}%</Text>
      {recoveryModeActive && <Text intent="danger">The system is in recovery mode!</Text>}
    </>
  );
};
