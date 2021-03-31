import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { useWeb3React } from "@web3-react/core";
import { Web3Provider } from "@ethersproject/providers";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../../InfoIcon";
import { useLiquity } from "../../../hooks/LiquityContext";
import { Badge } from "../../Badge";
import { fetchPrices } from "../context/fetchPrices";

const selector = ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
}: LiquityStoreState) => ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
});

export const Yield: React.FC = () => {
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();
  const { chainId } = useWeb3React<Web3Provider>();
  const isMainnet = chainId === 1;

  const { remainingLiquidityMiningLQTYReward, totalStakedUniTokens } = useLiquitySelector(selector);
  const [lqtyPrice, setLqtyPrice] = useState<Decimal | undefined>(undefined);
  const [uniLpPrice, setUniLpPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingLiquidityMiningLQTYReward.isZero || totalStakedUniTokens.isZero;
  let lqtyTokenAddress = addresses["lqtyToken"];
  let uniTokenAddress = addresses["uniToken"];

  // TODO: remove after Team has reviewed on /next
  if (!isMainnet) {
    lqtyTokenAddress = "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2";
    uniTokenAddress = "0xa478c2975ab1ea89e8196811f51a7b7ade33eb11";
  }

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
  }, [lqtyTokenAddress, uniTokenAddress]);

  // TODO: switch to this condition after team has reviewed on /next
  // if (!isMainnet || hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;
  if (hasZeroValue || lqtyPrice === undefined || uniLpPrice === undefined) return null;

  const remainingLqtyInUSD = remainingLiquidityMiningLQTYReward.mul(lqtyPrice);
  const totalStakedUniLpInUSD = totalStakedUniTokens.mul(uniLpPrice);
  const yieldPercentage = remainingLqtyInUSD.div(totalStakedUniLpInUSD).mul(100);

  return (
    <Badge>
      <Text>Yield {yieldPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ minWidth: ["auto", "306px"] }}>
            <Paragraph>
              This is an <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the LQTY return on
              staked UNI LP. The farm runs for 6-weeks, so the return is relative to the time
              remaining.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($LQTY_REWARDS / $UNI_LP) * 100 = <Text sx={{ fontWeight: "bold" }}> Yield</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingLqtyInUSD.shorten()} / ${totalStakedUniLpInUSD.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {yieldPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
