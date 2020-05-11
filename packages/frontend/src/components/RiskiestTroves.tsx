import React, { useState, useEffect, useCallback } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { Card, Button, Text, Box, Heading, Loader, Icon, Link, Tooltip } from "rimble-ui";
import styled from "styled-components";
import { theme } from "rimble-ui";
import { space, SpaceProps, layout, LayoutProps } from "styled-system";

import { Liquity, Trove } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";
import { shortenAddress } from "../utils/shortenAddress";
import { LoadingOverlay } from "./LoadingOverlay";
import { Transaction, useMyTransactionState } from "./Transaction";

const Table = styled.table<SpaceProps & LayoutProps>`
  ${space}
  ${layout}

  & tr td {
    text-align: center;
  }

  & tr td:nth-child(1) {
    width: 18%;
    text-align: right;
  }

  & tr td:nth-child(2) {
    width: 7%;
    text-align: left;
  }

  & tr td:nth-child(6) {
    width: 0;
  }
`;

Table.defaultProps = { theme, width: "100%" };

type RiskiestTrovesProps = {
  liquity: Liquity;
  numberOfTroves: number;
  price: Decimal;
  totalRedistributed: Trove;
};

type Resolved<T> = T extends Promise<infer U> ? U : T;

export const RiskiestTroves: React.FC<RiskiestTrovesProps> = ({
  liquity,
  numberOfTroves,
  price,
  totalRedistributed
}) => {
  type Troves = Resolved<ReturnType<typeof liquity.getLastTroves>>;

  const [loading, setLoading] = useState(true);
  const [trovesWithoutRewards, setTrovesWithoutRewards] = useState<Troves>();
  const myTransactionState = useMyTransactionState(/^liquidate-/);

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    liquity.getLastTroves(numberOfTroves).then(troves => {
      if (mounted) {
        setTrovesWithoutRewards(troves);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [liquity, numberOfTroves, reload]);

  useEffect(() => {
    if (myTransactionState.type === "confirmed") {
      forceReload();
    }
  }, [myTransactionState.type, forceReload]);

  const troves = trovesWithoutRewards?.map(
    ([owner, trove]) => [owner, trove.applyRewards(totalRedistributed)] as const
  );

  return (
    <Box mt={3} p={3}>
      <Card p={0}>
        <Heading
          as="h3"
          pl={3}
          py={2}
          pr={2}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          bg="lightgrey"
        >
          Riskiest Troves
          <Link
            color="text"
            hoverColor="success"
            activeColor="success"
            display="flex"
            alignItems="center"
            onClick={forceReload}
            opacity={loading ? 0 : 1}
          >
            <Icon name="Refresh" size="40px" />
          </Link>
        </Heading>

        {loading && (
          <LoadingOverlay>
            <Loader size="24px" color="text" />
          </LoadingOverlay>
        )}

        {!troves ? (
          <Text p={4} fontSize={3} textAlign="center">
            Loading...
          </Text>
        ) : troves.length === 0 ? (
          <Text p={4} fontSize={3} textAlign="center">
            There are no Troves yet
          </Text>
        ) : (
          <Table mt={3} mb={1}>
            <thead>
              <tr>
                <th colSpan={2}>Owner</th>
                <th>
                  Collateral
                  <br />
                  (ETH)
                </th>
                <th>
                  Debt
                  <br />
                  (LQTY)
                </th>
                <th>
                  Coll.
                  <br />
                  Ratio
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {troves.map(
                ([owner, trove]) =>
                  !trove.isEmpty && ( // making sure the Trove hasn't been liquidated
                    // (TODO: remove check after we can fetch multiple Troves in one call)
                    <tr key={owner}>
                      <td>
                        <Tooltip message={owner} placement="top">
                          <Text>{shortenAddress(owner)}</Text>
                        </Tooltip>
                      </td>
                      <td>
                        <CopyToClipboard text={owner}>
                          <Button.Text mainColor="text" size="small" icononly>
                            <Icon name="ContentCopy" size="16px" />
                          </Button.Text>
                        </CopyToClipboard>
                      </td>
                      <td>{trove.collateral.prettify(4)}</td>
                      <td>{trove.debt.prettify()}</td>
                      <td>
                        {(collateralRatio => (
                          <Text
                            color={
                              collateralRatio.gt(Liquity.CRITICAL_COLLATERAL_RATIO)
                                ? "success"
                                : collateralRatio.gt(Liquity.MINIMUM_COLLATERAL_RATIO)
                                ? "warning"
                                : "danger"
                            }
                          >
                            {new Percent(collateralRatio).prettify()}
                          </Text>
                        ))(trove.collateralRatio(price))}
                      </td>
                      <td>
                        <Transaction
                          id={`liquidate-${owner}`}
                          tooltip="Liquidate"
                          requires={[
                            [
                              trove.collateralRatioIsBelowMinimum(price),
                              "Collateral ratio not low enough"
                            ]
                          ]}
                          send={liquity.liquidate.bind(liquity, owner)}
                          numberOfConfirmationsToWait={1}
                        >
                          <Button.Text variant="danger" icon="DeleteForever" icononly />
                        </Transaction>
                      </td>
                    </tr>
                  )
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </Box>
  );
};
