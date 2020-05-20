import React, { useState } from "react";
import { Card, Box, Heading, Flex, Icon, Button } from "rimble-ui";
import { Transaction } from "./Transaction";

import { Liquity } from "@liquity/lib";
import { Label, EditableCell } from "./EditorCell";

type LiquidationManagerProps = {
  liquity: Liquity;
};

export const LiquidationManager: React.FC<LiquidationManagerProps> = ({ liquity }) => {
  const [numberOfTrovesToLiquidate, setNumberOfTrovesToLiquidate] = useState("40");

  return (
    <Card mt={4} p={0}>
      <Heading as="h3" bg="lightgrey" p={3}>
        Liquidate
      </Heading>

      <Box p={2}>
        <Flex alignItems="center">
          <Label>Up to</Label>

          <EditableCell
            width="40%"
            flexGrow={1}
            type="number"
            min="1"
            step="1"
            value={numberOfTrovesToLiquidate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNumberOfTrovesToLiquidate(e.target.value)
            }
          />

          <Label>Troves</Label>

          <Box height="32px">
            <Transaction
              id="batch-liquidate"
              tooltip="Liquidate"
              tooltipPlacement="bottom"
              send={overrides => {
                if (!numberOfTrovesToLiquidate) {
                  throw new Error("Invalid number");
                }
                return liquity.liquidateUpTo(parseInt(numberOfTrovesToLiquidate, 10), overrides);
              }}
              numberOfConfirmationsToWait={1}
            >
              <Button.Text ml={2} variant="danger" size="small" icononly>
                <Icon name="DeleteForever" size="32px" />
              </Button.Text>
            </Transaction>
          </Box>
        </Flex>
      </Box>
    </Card>
  );
};
