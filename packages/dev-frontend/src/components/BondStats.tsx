import React from "react";
import { Card, Heading, Text, Flex } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import * as l from "../components/Bonds/lexicon";
import { Statistic } from "./Statistic";
import { TreasuryChart } from "./TreasuryChart";
import { useBondView } from "./Bonds/context/BondViewContext";

type BondStatsProps = {
  variant?: string;
};

type MetricProps = {
  value: string | undefined;
  unit?: string;
};

const Metric: React.FC<MetricProps> = ({ value, unit }) => {
  return (
    <>
      {value}
      &nbsp;
      {unit && <Text sx={{ fontWeight: "light", fontSize: 1 }}>{unit}</Text>}
    </>
  );
};

export const BondStats: React.FC<BondStatsProps> = () => {
  const { stats, protocolInfo } = useBondView();

  if (stats === undefined || protocolInfo === undefined) return null;

  return (
    <Card variant="info">
      <Heading sx={{ fontweight: "bold" }}>LUSD bonds</Heading>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        bLUSD
      </Heading>
      <Statistic lexicon={l.BLUSD_MARKET_PRICE}>
        <Metric value={protocolInfo.marketPrice.prettify(3)} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.BLUSD_FAIR_PRICE}>
        <Metric
          value={
            protocolInfo.fairPrice.lower.eq(Decimal.INFINITY)
              ? "N/A"
              : `${protocolInfo.fairPrice.lower.prettify(
                  2
                )} - ${protocolInfo.fairPrice.upper.prettify(2)}`
          }
          unit="LUSD"
        />
      </Statistic>
      <Statistic lexicon={l.BLUSD_FLOOR_PRICE}>
        <Metric value={protocolInfo.floorPriceWithoutPendingHarvests.prettify(4)} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.BLUSD_WIND_DOWN_PRICE}>
        <Metric value={protocolInfo.windDownPrice.prettify(4)} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.BLUSD_APR}>
        <Metric
          value={
            protocolInfo.bLusdApr && protocolInfo.bLusdSupply.gt(0)
              ? protocolInfo.bLusdApr.mul(100).prettify(2)
              : "N/A"
          }
          unit="%"
        />
      </Statistic>
      <Statistic lexicon={l.BLUSD_LP_APR}>
        <Metric
          value={
            protocolInfo?.bLusdLpApr !== undefined ? protocolInfo.bLusdLpApr.prettify(2) : "N/A"
          }
          unit="%"
        />
      </Statistic>
      <Statistic lexicon={l.BLUSD_YIELD_AMPLIFICATION}>
        <Metric
          value={
            protocolInfo.yieldAmplification && protocolInfo.bLusdSupply.gt(0)
              ? protocolInfo.yieldAmplification.prettify(2)
              : "N/A"
          }
          unit="x"
        />
      </Statistic>
      <Statistic lexicon={l.BLUSD_SUPPLY}>
        <Metric value={protocolInfo.bLusdSupply.shorten()} unit="bLUSD" />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Statistics
      </Heading>
      <Statistic lexicon={l.PENDING_BONDS_STATISTIC}>
        <Metric value={stats.pendingBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.CANCELLED_BONDS_STATISTIC}>
        <Metric value={stats.cancelledBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.CLAIMED_BONDS_STATISTIC}>
        <Metric value={stats.claimedBonds.prettify(0)} />
      </Statistic>
      <Statistic lexicon={l.TOTAL_BONDS_STATISTIC}>
        <Metric value={stats.totalBonds.prettify(0)} />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Treasury
      </Heading>
      <Statistic lexicon={l.TREASURY_PENDING}>
        <Metric value={protocolInfo.treasury.pending.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_ACQUIRED}>
        <Metric value={protocolInfo.treasury.reserve.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_PERMANENT}>
        <Metric value={protocolInfo.treasury.permanent.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic lexicon={l.TREASURY_TOTAL}>
        <Metric value={protocolInfo.treasury.total.shorten()} unit="LUSD" />
      </Statistic>

      <Flex mt={3}>
        <TreasuryChart />
      </Flex>
    </Card>
  );
};
