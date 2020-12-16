import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui";
import { Transaction } from "./Transaction";

import { Decimal } from "@liquity/decimal";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { Icon } from "./Icon";

const selectPrice = ({ price }: LiquityStoreState) => price;

export const PriceManager: React.FC = () => {
  const {
    liquity: { send: liquity }
  } = useLiquity();
  const price = useLiquitySelector(selectPrice);
  const [editedPrice, setEditedPrice] = useState(price.toString(2));

  useEffect(() => {
    setEditedPrice(price.toString(2));
  }, [price]);

  return (
    <Card>
      <Heading>Price</Heading>

      <Box>
        <Flex sx={{ alignItems: "stretch" }}>
          <Label>ETH</Label>

          <Label variant="unit">$</Label>

          <Input
            type="number"
            step="any"
            value={editedPrice}
            onChange={e => setEditedPrice(e.target.value)}
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
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
