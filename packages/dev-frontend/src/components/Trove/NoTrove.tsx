import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useTroveView } from "./context/TroveViewContext";

export const NoTrove: React.FC = props => {
  const { dispatchEvent } = useTroveView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("OPEN_TROVE_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>Trove</Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You haven't borrowed any LUSD yet.">
          You can borrow LUSD by opening a Trove.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Open Trove</Button>
        </Flex>
      </Box>
    </Card>
  );
};
