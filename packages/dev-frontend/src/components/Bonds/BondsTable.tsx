/** @jsxImportSource theme-ui */
import React from "react";
import { Card, Text, Box, Heading, Flex, Grid, Button } from "theme-ui";
import { InfoIcon } from "../InfoIcon";
import * as lexicon from "./lexicon";
import { Empty } from "./views/idle/Empty";
import { Link } from "../Link";
import { useBondView } from "./context/BondViewContext";
import { Decimal } from "@liquity/lib-base";
import { InfiniteEstimate } from "./views/InfiniteEstimation";

const {
  BONDS,
  BOND_DEPOSIT: BOND_AMOUNT,
  ACCRUED_AMOUNT,
  MARKET_VALUE,
  OPTIMUM_REBOND_TIME,
  BREAK_EVEN_TIME
} = lexicon;

const LineSegment: React.FC = () => (
  <Flex
    sx={{
      borderTop: "1px dotted gray",
      width: "100%",
      mt: "-20px",
      mb: 0
    }}
  />
);

const formatDays = (days: number) =>
  days < 0
    ? "Elapsed"
    : days === 0
    ? "Now"
    : parseFloat(days.toFixed(1)) < 1
    ? `${days.toFixed(1)} days`
    : days > 10000
    ? Decimal.INFINITY.toString()
    : `${days.toFixed(0)} days`;

const Line = (columns: number) =>
  Array.from(Array(columns)).map((_, idx) => <LineSegment key={idx} />);

const columns = 5;

export const BondsTable: React.FC = () => {
  const { bonds, hasLoaded } = useBondView();

  if (!hasLoaded) return null;

  const pendingBonds = bonds ? bonds.filter(bond => bond.status === "PENDING") : [];
  const hasBonds = pendingBonds.length > 0;
  return (
    <Card>
      <Heading>
        <Flex>
          Pending bonds{" "}
          <InfoIcon
            placement="left"
            size="xs"
            tooltip={<Card variant="tooltip">{BONDS.description}</Card>}
          />
        </Flex>
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        {!hasBonds && <Empty />}
        {hasBonds && (
          <Grid
            gap="12px 0px"
            columns={[columns, "1fr 1fr 1.1fr 1.3fr 1fr"]}
            sx={{ alignItems: "center", justifyItems: "center", alignContent: "center" }}
          >
            <Text sx={{ fontWeight: "bold" }}>
              {BOND_AMOUNT.term}{" "}
              <InfoIcon
                size="xs"
                tooltip={<Card variant="tooltip">{BOND_AMOUNT.description}</Card>}
              />
            </Text>
            <Text sx={{ fontWeight: "bold" }}>
              {ACCRUED_AMOUNT.term}{" "}
              <InfoIcon
                size="xs"
                tooltip={<Card variant="tooltip">{ACCRUED_AMOUNT.description}</Card>}
              />
            </Text>
            <Text sx={{ fontWeight: "bold" }}>
              {MARKET_VALUE.term}{" "}
              <InfoIcon
                size="xs"
                tooltip={<Card variant="tooltip">{MARKET_VALUE.description}</Card>}
              />
            </Text>
            <Text sx={{ fontWeight: "bold" }}>
              {BREAK_EVEN_TIME.term}{" "}
              <InfoIcon
                size="xs"
                tooltip={<Card variant="tooltip">{BREAK_EVEN_TIME.description}</Card>}
              />
            </Text>
            <Text sx={{ fontWeight: "bold" }}>
              {OPTIMUM_REBOND_TIME.term}{" "}
              <InfoIcon
                size="xs"
                tooltip={<Card variant="tooltip">{OPTIMUM_REBOND_TIME.description}</Card>}
              />
            </Text>
            {Line(5)}

            {pendingBonds.map((bond, idx) => {
              const breakEvenDays = formatDays(
                (bond.breakEvenTime.getTime() - Date.now()) / 1000 / 60 / 60 / 24
              );
              const rebondDays = formatDays(
                (bond.rebondTime.getTime() - Date.now()) / 1000 / 60 / 60 / 24
              );
              return (
                <React.Fragment key={idx}>
                  <Text>{bond.deposit.shorten()} LUSD</Text>
                  <Text>{bond.accrued.shorten()} bLUSD</Text>
                  <Text>{bond.marketValue.shorten()} LUSD</Text>
                  <Text>
                    <InfiniteEstimate estimate={breakEvenDays} />
                  </Text>
                  <Text>
                    <InfiniteEstimate estimate={rebondDays} />
                  </Text>
                  {Line(5)}
                </React.Fragment>
              );
            })}
          </Grid>
        )}
        <Flex variant="layout.actions" mt={3}>
          <Link to="/bonds/pending" m={0} p={0}>
            <Button variant="primary">Go to bonds</Button>
          </Link>
        </Flex>
      </Box>
    </Card>
  );
};
