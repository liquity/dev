import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { Icon } from "../../Icon";
import { useMineView } from "../context/MineViewContext";
import { RemainingLQTY } from "./RemainingLQTY";

export const None: React.FC = () => {
  const { dispatchEvent } = useMineView();

  const handleDepositPressed = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Mine</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center", m: 2 }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              You aren't mining LQTY
            </Heading>
          </Flex>
          <RemainingLQTY />
          <Flex sx={{ fontSize: 2, mt: 2 }}>
            You can mine LQTY by depositing your Uniswap ETH/LUSD LP tokens
          </Flex>
          <Flex sx={{ fontSize: 2, mt: 2 }}>
            You can obtain LP tokens by adding liquidity to the ETH/LUSD pool on Uniswap
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button onClick={handleDepositPressed}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
