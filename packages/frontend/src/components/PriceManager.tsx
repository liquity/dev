import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Icon, Button } from "rimble-ui";
import { Transaction } from "./Transaction";

import { Liquity } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { Label, StaticCell, EditableCell } from "./EditorCell";

type PriceManagerProps = {
  liquity: Liquity;
  price: Decimal;
};

export const PriceManager: React.FC<PriceManagerProps> = ({ liquity, price }) => {
  const [editedPrice, setEditedPrice] = useState(price.prettify());

  useEffect(() => {
    setEditedPrice(price.prettify());
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
            width="47%"
            type="number"
            step="any"
            value={editedPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedPrice(e.target.value)}
          />
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
            <Button ml={2} size="small" icononly>
              <Icon name="Timeline" />
            </Button>
          </Transaction>
          <Transaction
            id="update-price"
            tooltip="Update from Oracle"
            tooltipPlacement="bottom"
            send={liquity.updatePrice.bind(liquity)}
            numberOfConfirmationsToWait={1}
          >
            <Button ml={2} size="small" icononly>
              <Icon name="Refresh" />
            </Button>
          </Transaction>
        </Flex>
      </Box>
    </Card>
  );
};
