import React, { useRef } from "react";
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
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card mt={4} p={0}>
      <Heading as="h3" bg="lightgrey" p={3}>
        Price
      </Heading>
      <Box p={2}>
        <Flex alignItems="stretch">
          <Label>ETH</Label>
          <StaticCell bg="#eee" textAlign="center">
            $
          </StaticCell>
          <EditableCell
            ref={priceInputRef}
            width="183px"
            type="number"
            step="any"
            defaultValue={price.prettify()}
            min={0}
            //onChange={(e: React.ChangeEvent<HTMLInputElement>) => {}}
          />
          <Flex width="43px" justifyContent="end" alignItems="center">
            <Transaction
              id="set-price"
              tooltip="Set"
              send={overrides => {
                const priceString = priceInputRef?.current?.value;
                if (!priceString) {
                  throw new Error("Invalid price");
                }
                return liquity.setPrice(Decimal.from(priceString), overrides);
              }}
            >
              <Button size="small" icononly>
                <Icon name="Timeline" />
              </Button>
            </Transaction>
          </Flex>
        </Flex>
      </Box>
    </Card>
  );
};
