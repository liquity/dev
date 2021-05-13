import React, { useEffect, useState } from "react";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../InfoIcon";
import { useLiquity } from "../../hooks/LiquityContext";
import { Badge } from "../Badge";
import { fetchLqtyPrice } from "./context/fetchLqtyPrice";

import classes from "./Yield.module.css";

const selector = ({ lusdInStabilityPool, remainingStabilityPoolLQTYReward }) => ({
  lusdInStabilityPool,
  remainingStabilityPoolLQTYReward
});

export const Yield = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();
  const { lusdInStabilityPool, remainingStabilityPoolLQTYReward } = useLiquitySelector(selector);

  const [lqtyPrice, setLqtyPrice] = useState(undefined);
  const hasZeroValue = remainingStabilityPoolLQTYReward.isZero || lusdInStabilityPool.isZero;
  const lqtyTokenAddress = addresses["lqtyToken"];

  useEffect(() => {
    (async () => {
      try {
        const { lqtyPriceUSD } = await fetchLqtyPrice(lqtyTokenAddress);
        setLqtyPrice(lqtyPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [lqtyTokenAddress]);

  if (hasZeroValue || lqtyPrice === undefined) return null;

  const yearlyHalvingSchedule = 0.5; // 50% see LQTY distribution schedule for more info
  const remainingLqtyOneYear = remainingStabilityPoolLQTYReward.mul(yearlyHalvingSchedule);
  const remainingLqtyOneYearInUSD = remainingLqtyOneYear.mul(lqtyPrice);
  const aprPercentage = remainingLqtyOneYearInUSD.div(lusdInStabilityPool).mul(100);
  const remainingLqtyInUSD = remainingStabilityPoolLQTYReward.mul(lqtyPrice);

  if (aprPercentage.isZero) return null;

  return (
    <p className={classes.wrapper}>
      APR {aprPercentage.toString(2)}%
      <InfoIcon
        tooltip={
          <>
            <p>
              An <span>estimate</span> of the LQTY return on the LUSD deposited to the Stability Pool
              over the next year, not including your ETH gains from liquidations.
            </p>
            <p sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              (($LQTY_REWARDS * YEARLY_DISTRIBUTION%) / DEPOSITED_LUSD) * 100 = <span> APR</span>
            </p>
            <p sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} * 50% / ${lusdInStabilityPool.shorten()}) * 100 =
              <span> {aprPercentage.toString(2)}%</span>
            </p>
          </>
        }
      ></InfoIcon>
    </p>
  );
};
