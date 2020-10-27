import React, { useState } from "react";
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui";
import { Transaction } from "./Transaction";

import { useLiquity } from "../hooks/LiquityContext";
import { Icon } from "./Icon";

export const LiquidationManager: React.FC = () => {
  const { liquity } = useLiquity();
  const [numberOfTrovesToLiquidate, setNumberOfTrovesToLiquidate] = useState("40");

  return (
    <Card>
      <Heading>Liquidate</Heading>

      <Box>
        <Flex sx={{ alignItems: "stretch" }}>
          <Label>Up to</Label>

          <Input
            type="number"
            min="1"
            step="1"
            value={numberOfTrovesToLiquidate}
            onChange={e => setNumberOfTrovesToLiquidate(e.target.value)}
          />

          <Label>Troves</Label>

          <Flex sx={{ ml: 2, alignItems: "center" }}>
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
              <Button variant="dangerIcon">
                <Icon name="trash" size="lg" />
              </Button>
            </Transaction>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
