import React, { useState, useEffect } from "react";
import CopyToClipboard from "react-copy-to-clipboard";
import { Card, Button, Text, Box, Heading, Loader, Icon, Link, Tooltip } from "rimble-ui";
import styled from "styled-components";
import { theme } from "rimble-ui";
import { space, SpaceProps, layout, LayoutProps } from "styled-system";

import { Liquity, Trove } from "@liquity/lib";
import { Decimal, Percent } from "@liquity/lib/dist/utils";
import { shortenAddress } from "../utils/shortenAddress";

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
    width: 48px;
  }

  & tr td:nth-child(6) {
    width: 48px;
  }
`;

Table.defaultProps = { theme, width: "100%" };

type RiskiestTrovesProps = {
  liquity: Liquity;
  numberOfTroves: number;
  price: Decimal;
};

const LoadingOverlay = styled.div<SpaceProps>`
  ${space}

  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;

  background-color: rgba(255, 255, 255, 0.66);

  display: flex;
  justify-content: end;
  align-items: start;
`;

LoadingOverlay.defaultProps = { p: 3 };

export const RiskiestTroves: React.FC<RiskiestTrovesProps> = ({
  liquity,
  numberOfTroves,
  price
}) => {
  const [loading, setLoading] = useState(true);
  const [troves, setTroves] = useState<[string, Trove | undefined][]>();

  const fetchRiskiestTroves = () => {
    let mounted = true;

    setLoading(true);

    liquity.getLastTroves(numberOfTroves).then(troves => {
      if (mounted) {
        setTroves(troves);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  };

  useEffect(fetchRiskiestTroves, [liquity, numberOfTroves]);

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
            display="flex"
            alignItems="center"
            onClick={fetchRiskiestTroves}
            opacity={loading ? 0 : 1}
          >
            <Icon name="Refresh" size="40" />
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
                <th>Collateral (ETH)</th>
                <th>Debt (QUI)</th>
                <th>Coll. Ratio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {troves.map(
                ([owner, trove]) =>
                  trove && (
                    <tr key={owner}>
                      <td>{shortenAddress(owner)}</td>
                      <td>
                        <CopyToClipboard text={owner}>
                          <Button.Text mainColor="text" size="small" icon="ContentCopy" icononly />
                        </CopyToClipboard>
                      </td>
                      <td>{trove.collateralAfterReward.prettify(4)}</td>
                      <td>{trove.debtAfterReward.prettify()}</td>
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
                        ))(trove.collateralRatioAfterRewardsAt(price))}
                      </td>
                      <td>
                        <Tooltip message="Liquidate" variant="light" placement="right">
                          <Button.Text
                            variant="danger"
                            icon="DeleteForever"
                            icononly
                            disabled={trove.collateralRatioAfterRewardsAt(price).gte(1.1)}
                            onClick={() => liquity.liquidate(owner)}
                          />
                        </Tooltip>
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
