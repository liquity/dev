import React from "react";
import { Card, Text, Heading, Link, Box } from "theme-ui";

import { Decimal, Percent } from "@liquity/decimal";
import { LiquityStoreState } from "@liquity/lib-base";
import { useSelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";

const selectBalances = ({ accountBalance, quiBalance }: LiquityStoreState) => ({
  accountBalance,
  quiBalance
});

const Balances: React.FC = () => {
  const { accountBalance, quiBalance } = useSelector(selectBalances);

  return (
    <Box sx={{ mb: 3 }}>
      <Heading>My Account Balances</Heading>
      <Text>ETH: {accountBalance.prettify(4)}</Text>
      <Text>LQTY: {quiBalance.prettify()}</Text>
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

const select = ({ numberOfTroves, price, total, quiInStabilityPool }: LiquityStoreState) => ({
  numberOfTroves,
  price,
  total,
  quiInStabilityPool
});

export const SystemStats: React.FC<SystemStatsProps> = ({ variant = "info", showBalances }) => {
  const { contractsVersion, deploymentDate } = useLiquity();
  const { numberOfTroves, price, quiInStabilityPool, total } = useSelector(select);

  const quiInStabilityPoolPct =
    total.debt.nonZero && new Percent(quiInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));

  return (
    <Card {...{ variant }}>
      {showBalances && <Balances />}

      <Heading>Liquity System</Heading>

      <Text>Total number of Liquity Troves: {Decimal.prettify(numberOfTroves)}</Text>
      <Text>LQTY in circulation: {total.debt.shorten()}</Text>
      {quiInStabilityPoolPct && (
        <Text>Fraction of LQTY in Stability Pool: {quiInStabilityPoolPct.toString(1)}</Text>
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
