import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { Decimal, StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
import { InfoIcon } from "../../InfoIcon";
import { useStabilio } from "../../../hooks/StabilioContext";
import { Badge } from "../../Badge";
import { fetchPrices } from "../context/fetchPrices";

const selector = ({
  remainingXbrlStblLiquidityMiningSTBLReward,
  totalStakedXbrlStblUniTokens
}: StabilioStoreState) => ({
  remainingXbrlStblLiquidityMiningSTBLReward,
  totalStakedXbrlStblUniTokens
});

export const XbrlStblYield: React.FC = () => {
  const {
    stabilio: {
      connection: { addresses, xbrlStblLiquidityMiningSTBLRewardRate }
    }
  } = useStabilio();

  const { remainingXbrlStblLiquidityMiningSTBLReward, totalStakedXbrlStblUniTokens } = useStabilioSelector(selector);
  const [stblPrice, setStblPrice] = useState<Decimal | undefined>(undefined);
  const [uniLpPrice, setUniLpPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingXbrlStblLiquidityMiningSTBLReward.isZero || totalStakedXbrlStblUniTokens.isZero;
  const stblTokenAddress = addresses["stblToken"];
  const uniTokenAddress = addresses["uniToken"];
  const secondsRemaining = remainingXbrlStblLiquidityMiningSTBLReward.div(xbrlStblLiquidityMiningSTBLRewardRate);
  const daysRemaining = secondsRemaining.div(60 * 60 * 24);

  useEffect(() => {
    (async () => {
      try {
        const { stblPriceUSD, uniLpPriceUSD } = await fetchPrices(stblTokenAddress, uniTokenAddress);
        setStblPrice(stblPriceUSD);
        setUniLpPrice(uniLpPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [stblTokenAddress, uniTokenAddress]);

  if (hasZeroValue || stblPrice === undefined || uniLpPrice === undefined) return null;

  const remainingStblInUSD = remainingXbrlStblLiquidityMiningSTBLReward.mul(stblPrice);
  const totalStakedUniLpInUSD = totalStakedXbrlStblUniTokens.mul(uniLpPrice);
  const yieldPercentage = remainingStblInUSD.div(totalStakedUniLpInUSD).mul(100);

  if (yieldPercentage.isZero) return null;

  return (
    <Badge>
      <Text>
        {daysRemaining?.prettify(0)} day yield {yieldPercentage.toString(2)}%
      </Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ minWidth: ["auto", "352px"] }}>
            <Paragraph>
              An <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the STBL return on staked UNI
              LP tokens. The farm runs for 6-weeks, and the return is relative to the time remaining.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($STBL_REWARDS / $STAKED_UNI_LP) * 100 ={" "}
              <Text sx={{ fontWeight: "bold" }}> Yield</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingStblInUSD.shorten()} / ${totalStakedUniLpInUSD.shorten()}) * 100 =
              <Text sx={{ fontWeight: "bold" }}> {yieldPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
