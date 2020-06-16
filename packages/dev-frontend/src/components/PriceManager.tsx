import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Button } from "theme-ui";
import { Transaction } from "./Transaction";

import { Decimal } from "@liquity/decimal";
import { Liquity } from "@liquity/lib";
import { useLiquity } from "../hooks/LiquityContext";
import { Label, StaticCell, EditableCell } from "./EditorCell";
import { Icon } from "./Icon";

type PriceManagerProps = {
  liquity: Liquity;
  price: Decimal;
};

export const PriceManager: React.FC<PriceManagerProps> = ({ liquity, price }) => {
  const { oracleAvailable } = useLiquity();
  const [editedPrice, setEditedPrice] = useState(price.toString(2));

  useEffect(() => {
    setEditedPrice(price.toString(2));
  }, [price]);

  return (
    <Card mt={4} p={0}>
      <Heading variant="editorTitle">Price</Heading>

      <Box p={2}>
        <Flex sx={{ alignItems: "stretch" }}>
          <Label>ETH</Label>

          <StaticCell bg="muted" textAlign="center">
            $
          </StaticCell>

          <EditableCell
            width="40%"
            flexGrow={1}
            type="number"
            step="any"
            value={editedPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedPrice(e.target.value)}
          />

          <Flex sx={{ ml: 2, alignItems: "center" }}>
            <Transaction
              id="set-price"
              tooltip="Set"
              tooltipPlacement="bottom"
              send={overrides => {
                if (!editedPrice) {
                  throw new Error("Invalid price");
                }
                return liquity.setPrice(Decimal.from(editedPrice), overrides);
              }}
              numberOfConfirmationsToWait={1}
            >
              <Button variant="icon">
                <Icon name="chart-line" size="lg" />
              </Button>
            </Transaction>

            <Transaction
              id="update-price"
              tooltip="Update from Oracle"
              tooltipPlacement="bottom"
              requires={[[oracleAvailable, "Only available on Ropsten"]]}
              send={liquity.updatePrice.bind(liquity)}
              numberOfConfirmationsToWait={1}
            >
              <Button variant="icon">
                <Icon name="redo" size="lg" />
              </Button>
            </Transaction>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
