import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { Icon } from "../Icon";
import { useTroveView } from "./context/TroveViewContext";

export const NoTrove: React.FC = props => {
  const { recordEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    recordEvent("OPEN_TROVE");
  }, []);

  return (
    <Card>
      <Heading>Trove</Heading>
      <Box>
        <Box sx={{ m: 2 }}>
          <Flex sx={{ alignItems: "center" }}>
            <Icon name="info-circle" size="2x" />
            <Heading as="h3" px={1}>
              You haven't borrowed any LUSD yet
            </Heading>
          </Flex>

          <Text sx={{ fontSize: 2 }}>You can borrow LUSD by opening a Trove</Text>
        </Box>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Open trove</Button>
        </Flex>
      </Box>
    </Card>
  );
};
