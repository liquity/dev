import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../InfoIcon";
import { useLiquity } from "../../hooks/LiquityContext";
import { Badge } from "../Badge";
import { fetchLqtyPrice } from "./context/fetchLqtyPrice";

const selector = ({ lusdInStabilityPool, remainingStabilityPoolLQTYReward }: LiquityStoreState) => ({
  lusdInStabilityPool,
  remainingStabilityPoolLQTYReward
});

export const Yield: React.FC = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();
  const { lusdInStabilityPool, remainingStabilityPoolLQTYReward } = useLiquitySelector(selector);
  const { chainId } = useWeb3React<Web3Provider>();
  const isMainnet = chainId === 1;

  const [lqtyPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingStabilityPoolLQTYReward.isZero || lusdInStabilityPool.isZero;
  let lqtyTokenAddress = addresses["lqtyToken"];

  // TODO: remove after Team has reviewed on /next
  if (!isMainnet) {
    lqtyTokenAddress = "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2";
  }

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

  // TODO: switch to this condition after team has reviewed on /next
  // if (!isMainnet || hasZeroValue || lqtyPrice === undefined) return null;
  if (hasZeroValue || lqtyPrice === undefined) return null;
  const yearlyHalvingSchedule = 0.5; // 50% see LQTY distribution schedule for more info
  const remainingLqtyOneYear = remainingStabilityPoolLQTYReward.mul(yearlyHalvingSchedule);
  const remainingLqtyInUSD = remainingLqtyOneYear.mul(lqtyPrice);
  const apyPercentage = remainingLqtyInUSD.div(lusdInStabilityPool).mul(100);

  return (
    <Badge>
      <Text>LQTY APY {apyPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ width: ["220px", "506px"] }}>
            <Paragraph>
              LQTY APY is an <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the LQTY return on
              deposited LUSD over the next year. This doesn't include the ETH gains.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($LQTY_REWARDS * YEARLY_DISTRIBUTION% / STABILITY_LUSD) * 100 ={" "}
              <Text sx={{ fontWeight: "bold" }}> APY</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} * 50% / ${lusdInStabilityPool.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {apyPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
