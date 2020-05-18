import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Icon, Button } from "rimble-ui";
import { Transaction } from "./Transaction";

import { Decimal } from "@liquity/decimal";
import { Liquity } from "@liquity/lib";
import { Label, StaticCell, EditableCell } from "./EditorCell";

type PriceManagerProps = {
  liquity: Liquity;
  price: Decimal;
};

export const PriceManager: React.FC<PriceManagerProps> = ({ liquity, price }) => {
  const [editedPrice, setEditedPrice] = useState(price.toString(2));

  useEffect(() => {
    setEditedPrice(price.toString(2));
  }, [price]);

  return (
    <Card mt={4} p={0}>
      <Heading as="h3" bg="lightgrey" p={3}>
        Price
      </Heading>

      <Box p={2}>
        <Flex alignItems="center">
          <Label>ETH</Label>

          <StaticCell bg="#eee" textAlign="center">
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

          <Flex height="32px">
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
              <Button.Text ml={2} size="small" icononly>
                <Icon name="Timeline" size="32px" />
              </Button.Text>
            </Transaction>

            <Transaction
              id="update-price"
              tooltip="Update from Oracle"
              tooltipPlacement="bottom"
              send={liquity.updatePrice.bind(liquity)}
              numberOfConfirmationsToWait={1}
            >
              <Button.Text ml={2} size="small" icononly>
                <Icon name="Refresh" size="32px" />
              </Button.Text>
            </Transaction>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
