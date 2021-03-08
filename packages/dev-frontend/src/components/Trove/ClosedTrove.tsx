import React from "react";
import { Card, Heading, Box, Flex, Text } from "theme-ui";
import { Icon } from "../Icon";
import { CollateralSurplusAction } from "../CollateralSurplusAction";

export const ClosedTrove: React.FC = () => {
  return (
    <Card>
      <Heading>Trove</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center" }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              Your Trove has been closed due to a liquidation or redemption
            </Heading>
          </Flex>

          <Text sx={{ fontSize: 2 }}>
            Please reclaim your remaining collateral before opening a new Trove
          </Text>
        </Box>

        <Flex sx={{ justifyContent: "flex-end" }} variant="layout.actions">
          <CollateralSurplusAction />
        </Flex>
      </Box>
    </Card>
  );
};
