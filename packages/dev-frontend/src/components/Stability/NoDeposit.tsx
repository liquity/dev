import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { Icon } from "../Icon";
import { useStabilityView } from "./context/StabilityViewContext";

export const NoDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Stability Pool</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center" }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              You don't have any LUSD in the Stability Pool
            </Heading>
          </Flex>

          <Text sx={{ fontSize: 2 }}>You can earn ETH and LQTY rewards by depositing LUSD</Text>
        </Box>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
