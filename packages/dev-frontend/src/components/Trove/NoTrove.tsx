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
      <Heading>Tesoro</Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="Todavía no has tomado prestado ningún PAI.">
        Puedes pedir prestado PAI abriendo un Tesoro.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Button onClick={handleOpenTrove}>Abrir un Tesoro</Button>
        </Flex>
      </Box>
    </Card>
  );
};
