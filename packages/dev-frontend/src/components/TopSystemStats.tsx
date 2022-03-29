import React, { useState } from "react";
import { Card, Heading, Box, Text } from "theme-ui";
import { Decimal, Percent, LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";
import { COIN, GT } from "../strings";
import { BigStatistic } from "./BigStatistic";

const selectBalances = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

const Balances: React.FC<ProtocolStatsProps> = ({ filterStats }) => {
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(selectBalances);
  const showStat = (statSection: string): boolean => {
    return filterStats ? filterStats.includes(statSection) : true;
  }

  return (
    <>
      {showStat("aut") && <BigStatistic name="AUT"> {accountBalance.prettify(4)}</BigStatistic>}
      {showStat("lusd") && <BigStatistic name={COIN}> {lusdBalance.prettify()}</BigStatistic>}
      {showStat("lqty") && <BigStatistic name={GT}>{lqtyBalance.prettify()}</BigStatistic>}
    </>
  );
};

const selectPrice = ({ price }: LiquityStoreState) => price;

const PriceFeed: React.FC<ProtocolStatsProps> = ({ filterStats }) => {
  const price = useLiquitySelector(selectPrice);
  const showStat = (statSection: string): boolean => {
    return filterStats ? filterStats.includes(statSection) : true;
  }
  return (
    <>
      {showStat("aut") && <BigStatistic name="AUT">${price.prettify()}</BigStatistic>}
    </>
  );
};

// const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
//     children?.match(/[0-9a-f]{40}/) ? (
//         <Link href={`https://github.com/goldmandao/fluidity/commit/${children}`}>{children.substr(0, 7)}</Link>
//     ) : (
//             <>unknown</>
//         );

type ProtocolStatsProps = {
  filterStats?: string[];
}

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
});

const ProtocolStats: React.FC<ProtocolStatsProps> = ({ filterStats }) => {

  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    redemptionRate,
    totalStakedLQTY,
  } = useLiquitySelector(select);

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const redemptionFeePct = new Percent(redemptionRate);

  const showStat = (statSection: string): boolean => {
    return filterStats ? filterStats.includes(statSection) : true;
  }

  return (
    <>
      {showStat("borrow-fee") &&
        <BigStatistic
          name="Borrowing Fee"
          tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in LUSD) and is part of a Trove's debt. The fee varies between 0.5% and 5% depending on LUSD redemption volumes."
        >
          {borrowingFeePct.toString(2)}
        </BigStatistic>
      }
      {showStat("redeem-fee") &&
        <BigStatistic
          name="Redemption Fee"
          tooltip="The Redemption Fee is a one-off fee charged as a percentage of the redeemed amount (in AUT). The fee varies from 0.5% depending on LUSD redemption volumes."
        >
          {redemptionFeePct.toString(2)}
        </BigStatistic>
      }
      {showStat("tvl") &&
        <BigStatistic
          name="TVL"
          tooltip="The Total Value Locked (TVL) is the total value of AUT locked as collateral in the system, given in AUT and USD."
        >
          {total.collateral.shorten()} <Text sx={{ fontSize: 2 }}>&nbsp;AUT</Text>
        </BigStatistic>
      }
      {showStat("troves") &&
        <BigStatistic name="Opened Troves" tooltip="The total number of active Troves in the system.">
          {Decimal.from(numberOfTroves).prettify(0)}
        </BigStatistic>
      }
      {showStat("lusd-supply") &&
        <BigStatistic name="LUSD supply" tooltip="The total LUSD minted by the Liquity Protocol.">
          {total.debt.shorten()}
        </BigStatistic>
      }
      {showStat("lusd-sp") && lusdInStabilityPoolPct && (
        <BigStatistic
          name="LUSD in Stability Pool"
          tooltip="The total LUSD currently held in the Stability Pool, expressed as an amount and a fraction of the LUSD supply." >
          {lusdInStabilityPool.shorten()}
          <Text sx={{ fontSize: 1 }}>&nbsp;({lusdInStabilityPoolPct.toString(1)})</Text>
        </BigStatistic>
      )}
      {showStat("staked-lqty") &&
        <BigStatistic
          name="Staked LQTY"
          tooltip="The total amount of LQTY that is staked for earning fee revenue."
        >
          {totalStakedLQTY.shorten()}
        </BigStatistic>
      }
      {showStat("tcr") &&
        <BigStatistic
          name="TCR"
          tooltip="The ratio of the Dollar value of the entire system collateral at the current AUT:USD price, to the entire system debt."
        >
          {totalCollateralRatioPct.prettify()}
        </BigStatistic>
      }
      {showStat("recovery") &&
        <BigStatistic
          name="Recovery Mode"
          tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Trove can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Trove's debt. Operations are also restricted that would negatively impact the TCR."
        >
          {total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}
        </BigStatistic>
      }

    </>
  );
};

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
  showProtocol?: boolean;
  showPriceFeed?: boolean;
  filterStats?: string[];
};

export const TopSystemStats: React.FC<SystemStatsProps> = (
  { variant = "info", showBalances, showProtocol, showPriceFeed, filterStats }) => {

  const [showStats, setShow] = useState(false);
  /*
  const {
      liquity: {
          connection: { version: contractsVersion, deploymentDate, frontendTag }
      }
  } = useLiquity();
  */

  const statSections = () => (
    <Box sx={{
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-evenly",
      flex: "grow",
      paddingBottom: "20px",
      marginTop: "-40px"
    }}>
      {showBalances && <Balances filterStats={filterStats} />}
      {showProtocol && <ProtocolStats filterStats={filterStats} />}
      {showPriceFeed && <PriceFeed filterStats={filterStats} />}
    </Box>
  )

  return (
    <>
      {statSections()}
    </>
  )
}

