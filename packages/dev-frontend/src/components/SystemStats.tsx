import React from "react";
import { Card, Text, Heading, Link, Box } from "theme-ui";

import { Decimal, Percent } from "@liquity/decimal";
import { LiquityStoreState } from "@liquity/lib-base";
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
      <Text>ETH: {accountBalance.prettify(4)}</Text>
      <Text>
        {COIN}: {lusdBalance.prettify()}
      </Text>
      <Text>
        {GT}: {lqtyBalance.prettify()}
      </Text>
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
  borrowingFeeFactor,
  redemptionFeeFactor
}: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingFeeFactor,
  redemptionFeeFactor
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const { contractsVersion, deploymentDate } = useLiquity();
  const {
    numberOfTroves,
    price,
    lusdInStabilityPool,
    total,
    borrowingFeeFactor,
    redemptionFeeFactor
  } = useLiquitySelector(select);

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
  const borrowingFeePct = new Percent(borrowingFeeFactor);
  const redemptionFeePct = new Percent(redemptionFeeFactor);

  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <Heading>Liquity System</Heading>

      <Text>Borrowing fee: {borrowingFeePct.toString(2)}</Text>
      <Text>Redemption fee: {redemptionFeePct.toString(2)}</Text>

      <Text sx={{ mt: 2 }}>Total number of Liquity Troves: {Decimal.prettify(numberOfTroves)}</Text>
      <Text>
        Total {COIN} supply: {total.debt.shorten()}
      </Text>
      {lusdInStabilityPoolPct && (
        <Text>
          Fraction of {COIN} in Stability Pool: {lusdInStabilityPoolPct.toString(1)}
        </Text>
      )}
      <Text>Total collateral ratio: {totalCollateralRatioPct.prettify()}</Text>
      {total.collateralRatioIsBelowCritical(price) && (
        <Text color="danger">The system is in recovery mode!</Text>
      )}

      <Box sx={{ mt: 3, opacity: 0.66 }}>
        <Text sx={{ fontSize: 0 }}>
          Contracts version: <GitHubCommit>{contractsVersion}</GitHubCommit>
        </Text>
        <Text sx={{ fontSize: 0 }}>Deployed: {new Date(deploymentDate).toLocaleString()}</Text>
        <Text sx={{ fontSize: 0 }}>
          Frontend version:{" "}
          {process.env.NODE_ENV === "development" ? (
            "development"
          ) : (
            <GitHubCommit>{process.env.REACT_APP_VERSION}</GitHubCommit>
          )}
        </Text>
      </Box>
    </Card>
  );
};
