import React, { useState, useEffect, useCallback } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { Card, Button, Text, Box, Heading, Flex } from "theme-ui";

import { Percent } from "@liquity/decimal";
import { MINIMUM_COLLATERAL_RATIO, CRITICAL_COLLATERAL_RATIO } from "@liquity/lib-base";
import { BlockPolledLiquityStoreState } from "@liquity/lib-ethers";
import { useLiquitySelector } from "@liquity/lib-react";

import { shortenAddress } from "../utils/shortenAddress";
import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";

import { Icon } from "./Icon";
import { LoadingOverlay } from "./LoadingOverlay";
import { Transaction } from "./Transaction";
import { Tooltip } from "./Tooltip";
import { Abbreviation } from "./Abbreviation";

const rowHeight = "40px";

type RiskiestTrovesProps = {
  pageSize: number;
};

type Resolved<T> = T extends Promise<infer U> ? U : T;

const select = ({
  numberOfTroves,
  price,
  totalRedistributed,
  blockTag
}: BlockPolledLiquityStoreState) => ({ numberOfTroves, price, totalRedistributed, blockTag });

export const RiskiestTroves: React.FC<RiskiestTrovesProps> = ({ pageSize }) => {
  const { blockTag, numberOfTroves, price, totalRedistributed } = useLiquitySelector(select);
  const { liquity } = useLiquity();
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
    ([owner, trove]) => [owner, trove.applyRedistribution(totalRedistributed)] as const
  );

  return (
    <Card sx={{ width: "100%" }}>
      <Heading>
        <Abbreviation short="Troves">Riskiest Troves</Abbreviation>

        <Flex sx={{ alignItems: "center" }}>
          {numberOfTroves !== 0 && (
            <>
              <Abbreviation
                short={`page ${clampedPage + 1} / ${numberOfPages}`}
                sx={{ mr: [0, 3], fontWeight: "body", fontSize: [1, 2], letterSpacing: [-1, 0] }}
              >
                {clampedPage * pageSize + 1}-{Math.min((clampedPage + 1) * pageSize, numberOfTroves)}{" "}
                of {numberOfTroves}
              </Abbreviation>

              <Button variant="titleIcon" onClick={previousPage} disabled={clampedPage <= 0}>
                <Icon name="chevron-left" size="lg" />
              </Button>

              <Button
                variant="titleIcon"
                onClick={nextPage}
                disabled={clampedPage >= numberOfPages - 1}
              >
                <Icon name="chevron-right" size="lg" />
              </Button>
            </>
          )}

          <Button
            variant="titleIcon"
            sx={{ opacity: loading ? 0 : 1, ml: [0, 3] }}
            onClick={forceReload}
          >
            <Icon name="redo" size="lg" />
          </Button>
        </Flex>
      </Heading>

      {loading && <LoadingOverlay />}

      {!troves || troves.length === 0 ? (
        <Box>
          <Box sx={{ p: 4, fontSize: 3, textAlign: "center" }}>
            {!troves ? "Loading..." : "There are no Troves yet"}
          </Box>
        </Box>
      ) : (
        <Box>
          <Box
            as="table"
            sx={{
              mt: 2,
              pl: [1, 4],
              width: "100%",

              textAlign: "center",
              lineHeight: 1.15
            }}
          >
            <colgroup>
              <col style={{ width: "50px" }} />
              <col />
              <col />
              <col />
              <col style={{ width: rowHeight }} />
            </colgroup>

            <thead>
              <tr>
                <th>Owner</th>
                <th>
                  <Abbreviation short="Coll.">Collateral</Abbreviation>
                  <Box sx={{ fontSize: [0, 1], fontWeight: "body", opacity: 0.5 }}>ETH</Box>
                </th>
                <th>
                  Debt
                  <Box sx={{ fontSize: [0, 1], fontWeight: "body", opacity: 0.5 }}>{COIN}</Box>
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
                      <td
                        style={{
                          display: "flex",
                          alignItems: "center",
                          height: rowHeight
                        }}
                      >
                        <Tooltip message={owner} placement="top">
                          <Text
                            variant="address"
                            sx={{
                              width: ["73px", "unset"],
                              overflow: "hidden",
                              position: "relative"
                            }}
                          >
                            {shortenAddress(owner)}
                            <Box
                              sx={{
                                display: ["block", "none"],
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "50px",
                                height: "100%",
                                background:
                                  "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)"
                              }}
                            />
                          </Text>
                        </Tooltip>

                        <CopyToClipboard text={owner} onCopy={() => setCopied(owner)}>
                          <Button variant="icon" sx={{ width: "24px", height: "24px" }}>
                            <Icon
                              name={copied === owner ? "clipboard-check" : "clipboard"}
                              size="sm"
                            />
                          </Button>
                        </CopyToClipboard>
                      </td>
                      <td>
                        <Abbreviation short={trove.collateral.shorten()}>
                          {trove.collateral.prettify(4)}
                        </Abbreviation>
                      </td>
                      <td>
                        <Abbreviation short={trove.debt.shorten()}>
                          {trove.debt.prettify()}
                        </Abbreviation>
                      </td>
                      <td>
                        {(collateralRatio => (
                          <Text
                            color={
                              collateralRatio.gt(CRITICAL_COLLATERAL_RATIO)
                                ? "success"
                                : collateralRatio.gt(MINIMUM_COLLATERAL_RATIO)
                                ? "warning"
                                : "danger"
                            }
                          >
                            {collateralRatio?.gt(10)
                              ? "× " + collateralRatio.shorten()
                              : new Percent(collateralRatio).prettify()}
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
                            ],
                            [numberOfTroves > 1, "Can't liquidate when only one Trove exists"]
                          ]}
                          send={liquity.send.liquidate.bind(liquity.send, owner)}
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
          </Box>
        </Box>
      )}
    </Card>
  );
};
