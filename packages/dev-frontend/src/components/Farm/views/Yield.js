import { useEffect, useState } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../../../hooks/LiquityContext";
import { fetchPrices } from "../context/fetchPrices";

import { InfoIcon } from "../../InfoIcon";

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

  return (
    <p className={classes.wrapper}>
      Yield {yieldPercentage.toString(2)}%{" "}
      <InfoIcon
        tooltip={
          <>
            <p>
              An <span sx={{ fontWeight: "bold" }}>estimate</span> of the LQTY return on staked UNI
              LP tokens. The farm runs for 6-weeks, and the return is relative to the time remaining.
            </p>
            <p sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($LQTY_REWARDS / $STAKED_UNI_LP) * 100 ={" "}
              <span sx={{ fontWeight: "bold" }}> Yield</span>
            </p>
            <p sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} / ${totalStakedUniLpInUSD.shorten()}) * 100 =
              <span sx={{ fontWeight: "bold" }}> {yieldPercentage.toString(2)}%</span>
            </p>
          </>
        }
      ></InfoIcon>
    </p>
  );
};
