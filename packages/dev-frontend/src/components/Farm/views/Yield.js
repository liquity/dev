import { useEffect, useState } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../../../hooks/LiquityContext";
import { fetchPrices } from "../context/fetchPrices";

import classes from "./Yield.module.css";

const selector = ({ remainingLiquidityMiningLQTYReward, totalStakedUniTokens }) => ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
});

export const Yield = () => {
  const {
    liquity: {
      connection: { addresses, liquidityMiningLQTYRewardRate }
    }
  } = useLiquity();

  const { remainingLiquidityMiningLQTYReward, totalStakedUniTokens } = useLiquitySelector(selector);
  const [lqtyPrice, setLqtyPrice] = useState(undefined);
  const [uniLpPrice, setUniLpPrice] = useState(undefined);
  const hasZeroValue = remainingLiquidityMiningLQTYReward.isZero || totalStakedUniTokens.isZero;
  const lqtyTokenAddress = addresses["lqtyToken"];
  const uniTokenAddress = addresses["uniToken"];
  const secondsRemaining = remainingLiquidityMiningLQTYReward.div(liquidityMiningLQTYRewardRate);
  const daysRemaining = secondsRemaining.div(60 * 60 * 24);

  useEffect(() => {
    (async () => {
      try {
        const { lqtyPriceUSD, uniLpPriceUSD } = await fetchPrices(lqtyTokenAddress, uniTokenAddress);
        setLqtyPrice(lqtyPriceUSD);
        setUniLpPrice(uniLpPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [lqtyTokenAddress, setLqtyPrice, setUniLpPrice, uniTokenAddress]);

  if (hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;

  const remainingLqtyInUSD = remainingLiquidityMiningLQTYReward.mul(lqtyPrice);
  const totalStakedUniLpInUSD = totalStakedUniTokens.mul(uniLpPrice);
  const yieldPercentage = remainingLqtyInUSD.div(totalStakedUniLpInUSD).mul(100);

  if (yieldPercentage.isZero) return null;

  return <p className={classes.wrapper}>Yield {yieldPercentage.toString(2)}%</p>;
};
