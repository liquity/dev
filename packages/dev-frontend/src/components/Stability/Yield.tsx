import React, { useEffect, useState } from "react";
import { Card, Paragraph, Text } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { InfoIcon } from "../InfoIcon";
import { Badge } from "../Badge";
import { fetchStblPrice } from "./context/fetchStblPrice";

const selector = ({ xbrlInStabilityPool, remainingStabilityPoolSTBLReward }: LiquityStoreState) => ({
  xbrlInStabilityPool,
  remainingStabilityPoolSTBLReward
});

const yearlyIssuanceFraction = 0.5;
const dailyIssuanceFraction = Decimal.from(1 - yearlyIssuanceFraction ** (1 / 365));
const dailyIssuancePercentage = dailyIssuanceFraction.mul(100);

export const Yield: React.FC = () => {
  const { xbrlInStabilityPool, remainingStabilityPoolSTBLReward } = useLiquitySelector(selector);

  const [stblPrice, setStblPrice] = useState<Decimal | undefined>(undefined);
  const hasZeroValue = remainingStabilityPoolSTBLReward.isZero || xbrlInStabilityPool.isZero;

  useEffect(() => {
    (async () => {
      try {
        const { stblPriceUSD } = await fetchStblPrice();
        setStblPrice(stblPriceUSD);
      } catch (error) {
        console.error(error);
      }
    })();
  }, []);

  if (hasZeroValue || stblPrice === undefined) return null;

  const stblIssuanceOneDay = remainingStabilityPoolSTBLReward.mul(dailyIssuanceFraction);
  const stblIssuanceOneDayInUSD = stblIssuanceOneDay.mul(stblPrice);
  const aprPercentage = stblIssuanceOneDayInUSD.mulDiv(365 * 100, xbrlInStabilityPool);
  const remainingStblInUSD = remainingStabilityPoolSTBLReward.mul(stblPrice);

  if (aprPercentage.isZero) return null;

  return (
    <Badge>
      <Text>STBL APR {aprPercentage.toString(2)}%</Text>
      <InfoIcon
        tooltip={
          <Card variant="tooltip" sx={{ width: ["220px", "518px"] }}>
            <Paragraph>
              An <Text sx={{ fontWeight: "bold" }}>estimate</Text> of the STBL return on the xBRL
              deposited to the Stability Pool over the next year, not including your ETH gains from
              liquidations.
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace", mt: 2 }}>
              ($STBL_REWARDS * DAILY_ISSUANCE% / DEPOSITED_XBRL) * 365 * 100 ={" "}
              <Text sx={{ fontWeight: "bold" }}> APR</Text>
            </Paragraph>
            <Paragraph sx={{ fontSize: "12px", fontFamily: "monospace" }}>
              ($
              {remainingStblInUSD.shorten()} * {dailyIssuancePercentage.toString(4)}% / $
              {xbrlInStabilityPool.shorten()}) * 365 * 100 =
              <Text sx={{ fontWeight: "bold" }}> {aprPercentage.toString(2)}%</Text>
            </Paragraph>
          </Card>
        }
      ></InfoIcon>
    </Badge>
  );
};
