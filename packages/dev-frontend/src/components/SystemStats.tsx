import React from "react";
import { Card, Heading, Link, Box } from "theme-ui";

import { Decimal, Percent, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { COIN, GT } from "../strings";

const selectBalances = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

const Balances: React.FC = () => {
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Box>ETH: {accountBalance.prettify(4)}</Box>
      <Box>
        {COIN}: {lusdBalance.prettify()}
      </Box>
      <Box>
        {GT}: {lqtyBalance.prettify()}
      </Box>
    </Box>
  );
};

const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
  children?.match(/[0-9a-f]{40}/) ? (
    <Link href={`https://github.com/liquity/dev/commit/${children}`}>{children.substr(0, 7)}</Link>
  ) : (
    <>unknown</>
  );

type SystemStatsProps = {
  variant?: string;
  showBalances?: boolean;
};

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const {
    liquity: {
      connection: { version: contractsVersion, deploymentDate }
    }
  } = useLiquity();

  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingRate,
    redemptionRate,
    totalStakedLQTY,
    kickbackRate
  } = useLiquitySelector(select);

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingRate);
  const redemptionFeePct = new Percent(redemptionRate);

  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <Heading>Liquity System</Heading>

      <Box>Borrowing fee: {borrowingFeePct.toString(2)}</Box>
      <Box>Redemption fee: {redemptionFeePct.toString(2)}</Box>

      <Box sx={{ my: 2 }}>
        <Box>TVL (ETH): {Decimal.from(total.collateral).prettify(0)}</Box>
        <Box>TVL (USD): ${Decimal.from(total.collateral.mul(price)).prettify(0)}</Box>
      </Box>
      <Box>Number of Liquity Troves: {Decimal.from(numberOfTroves).prettify(0)}</Box>
      <Box>
        Total {COIN} supply: {total.debt.shorten()}
      </Box>
      {lusdInStabilityPoolPct && (
        <Box>
          Fraction of {COIN} in Stability Pool: {lusdInStabilityPoolPct.toString(1)}
        </Box>
      )}
      <Box>Total staked LQTY: {totalStakedLQTY.shorten()}</Box>
      <Box>Total collateral ratio: {totalCollateralRatioPct.prettify()}</Box>
      {kickbackRate && <Box>Kickback rate: {kickbackRate.mul(100).prettify()}%</Box>}
      {total.collateralRatioIsBelowCritical(price) && (
        <Box color="danger">The system is in recovery mode!</Box>
      )}

      <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Box sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Box>
        <Box sx={{ fontSize: 0 }}>Deployed: {deploymentDate.toLocaleString()}</Box>
        <Box sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          {process.env.NODE_ENV === "development" ? (
            "development"
          ) : (
            <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
          )}
        </Box>
      </Box>
    </Card>
  );
};
