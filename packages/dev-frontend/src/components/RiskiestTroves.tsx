import React, { useState, useEffect, useCallback } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { Card, Button, Text, Box, Heading, Flex } from "theme-ui";
import styled from "styled-components";
import { space, SpaceProps, layout, LayoutProps } from "styled-system";

import { Decimal, Percent } from "@liquity/decimal";
import { Liquity, Trove } from "@liquity/lib";
import { shortenAddress } from "../utils/shortenAddress";
import { LoadingOverlay } from "./LoadingOverlay";
import { Transaction } from "./Transaction";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import theme from "../theme";

const Table = styled.table<SpaceProps & LayoutProps>`
  ${space}
  ${layout}

  & tr th {
    line-height: 1.15;
  }

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
    width: 40px;
  }
`;

Table.defaultProps = { theme, width: "100%" };

type RiskiestTrovesProps = {
  pageSize: number;
  liquity: Liquity;
  numberOfTroves: number;
  price: Decimal;
  totalRedistributed: Trove;
  blockTag?: number;
};

type Resolved<T> = T extends Promise<infer U> ? U : T;

export const RiskiestTroves: React.FC<RiskiestTrovesProps> = ({
  pageSize,
  liquity,
  numberOfTroves,
  price,
  totalRedistributed,
  blockTag
}) => {
  type Troves = Resolved<ReturnType<typeof liquity.getLastTroves>>;

  const [loading, setLoading] = useState(true);
  const [trovesWithoutRewards, setTrovesWithoutRewards] = useState<Troves>();

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  const [page, setPage] = useState(0);
  const numberOfPages = Math.ceil(numberOfTroves / pageSize) || 1;
  const clampedPage = Math.min(page, numberOfPages - 1);

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1);
    }
  };

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1);
    }
  };

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage);
    }
  }, [page, clampedPage]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    liquity.getLastTroves(clampedPage * pageSize, pageSize, { blockTag }).then(troves => {
      if (mounted) {
        setTrovesWithoutRewards(troves);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [liquity, clampedPage, pageSize, reload]);

  useEffect(() => {
    forceReload();
  }, [forceReload, numberOfTroves]);

  const [copied, setCopied] = useState<string>();

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined);
        }
      }, 2000);

      return () => {
        cancelled = true;
      };
    }
  }, [copied]);

  const troves = trovesWithoutRewards?.map(
    ([owner, trove]) => [owner, trove.applyRewards(totalRedistributed)] as const
  );

  return (
    <Box mt={3} p={3}>
      <Card p={0}>
        <Heading variant="editorTitle">
          Riskiest Troves
          <Flex sx={{ alignItems: "center" }}>
            {numberOfTroves !== 0 && (
              <>
                <Text sx={{ mr: 3, fontWeight: "body", fontSize: 2 }}>
                  {clampedPage * pageSize + 1}-
                  {Math.min((clampedPage + 1) * pageSize, numberOfTroves)} of {numberOfTroves}
                </Text>
                <Button variant="titleIcon" onClick={previousPage}>
                  <Icon name="chevron-left" size="lg" />
                </Button>
                <Button variant="titleIcon" onClick={nextPage}>
                  <Icon name="chevron-right" size="lg" />
                </Button>
              </>
            )}
            <Button
              variant="titleIcon"
              sx={{ opacity: loading ? 0 : 1, ml: 3 }}
              onClick={forceReload}
            >
              <Icon name="redo" size="lg" />
            </Button>
          </Flex>
        </Heading>

        {loading && <LoadingOverlay />}

        {!troves ? (
          <Text sx={{ p: 4, fontSize: 3, textAlign: "center" }}>Loading...</Text>
        ) : troves.length === 0 ? (
          <Text sx={{ p: 4, fontSize: 3, textAlign: "center" }}>There are no Troves yet</Text>
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
                        <CopyToClipboard text={owner} onCopy={() => setCopied(owner)}>
                          <Button variant="icon" sx={{ width: "24px", height: "24px" }}>
                            <Icon
                              name={copied === owner ? "clipboard-check" : ["far", "clipboard"]}
                              size="sm"
                            />
                          </Button>
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
                          <Button variant="dangerIcon">
                            <Icon name="trash" />
                          </Button>
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
