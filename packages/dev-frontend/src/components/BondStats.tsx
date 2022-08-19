import React from "react";
import { Card, Heading, Text } from "theme-ui";
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
  const { treasury, stats, protocolInfo } = useBondView();

  if (treasury === undefined || stats === undefined || protocolInfo === undefined) return null;

  return (
    <Card variant="info">
      <Heading sx={{ fontweight: "bold" }}>LUSD bonds</Heading>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        bLUSD
      </Heading>
      <Statistic name={l.BLUSD_MARKET_PRICE.term} tooltip={l.BLUSD_MARKET_PRICE.description}>
        <Metric value={protocolInfo.marketPrice.prettify(2)} unit="LUSD" />
      </Statistic>
      <Statistic name={l.BLUSD_FAIR_PRICE.term} tooltip={l.BLUSD_FAIR_PRICE.description}>
        <Metric value={protocolInfo.fairPrice.prettify(2)} unit="LUSD" />
      </Statistic>
      <Statistic name={l.BLUSD_FLOOR_PRICE.term} tooltip={l.BLUSD_FLOOR_PRICE.description}>
        <Metric value={protocolInfo.floorPrice.prettify(2)} unit="LUSD" />
      </Statistic>
      <Statistic name={l.BLUSD_SUPPLY.term} tooltip={l.BLUSD_SUPPLY.description}>
        <Metric value={protocolInfo.bLusdSupply.shorten()} unit="bLUSD" />
      </Statistic>
      <Statistic name={"Yield amplification"} tooltip={"TODO"}>
        <Metric value={"1.1"} unit="x" />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Statistics
      </Heading>
      <Statistic
        name={l.PENDING_BONDS_STATISTIC.term}
        tooltip={l.PENDING_BONDS_STATISTIC.description}
      >
        <Metric value={stats.pendingBonds.prettify(0)} />
      </Statistic>
      <Statistic
        name={l.CANCELLED_BONDS_STATISTIC.term}
        tooltip={l.CANCELLED_BONDS_STATISTIC.description}
      >
        <Metric value={stats.cancelledBonds.prettify(0)} />
      </Statistic>
      <Statistic
        name={l.CLAIMED_BONDS_STATISTIC.term}
        tooltip={l.CLAIMED_BONDS_STATISTIC.description}
      >
        <Metric value={stats.claimedBonds.prettify(0)} />
      </Statistic>
      <Statistic name={l.TOTAL_BONDS_STATISTIC.term} tooltip={l.TOTAL_BONDS_STATISTIC.description}>
        <Metric value={stats.totalBonds.prettify(0)} />
      </Statistic>

      <Heading as="h2" sx={{ mt: 3, fontWeight: "body" }}>
        Treasury
      </Heading>
      <Statistic name={l.TREASURY_PENDING.term} tooltip={l.TREASURY_PENDING.description}>
        <Metric value={treasury.pending.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic name={l.TREASURY_ACQUIRED.term} tooltip={l.TREASURY_ACQUIRED.description}>
        <Metric value={treasury.reserve.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic name={l.TREASURY_PERMANENT.term} tooltip={l.TREASURY_PERMANENT.description}>
        <Metric value={treasury.permanent.shorten()} unit="LUSD" />
      </Statistic>
      <Statistic name={l.TREASURY_TOTAL.term} tooltip={l.TREASURY_TOTAL.description}>
        <Metric value={treasury.total.shorten()} unit="LUSD" />
      </Statistic>

      <TreasuryChart />
    </Card>
  );
};
