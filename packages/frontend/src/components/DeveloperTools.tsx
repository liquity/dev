import React, { useRef } from "react";
import { Text, Input, Button, Flex, Box, Heading } from "rimble-ui";

import { Liquity } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";

type DeveloperToolsProps = {
  liquity: Liquity;
  price: Decimal;
};

export const DeveloperTools: React.FC<DeveloperToolsProps> = ({ liquity, price }) => {
  const priceInputRef = useRef<HTMLInputElement | null>();
  const numberOfTrovesToLiquidateInputRef = useRef<HTMLInputElement | null>();

  return (
    <Box mt={4}>
      <Heading m={4} textAlign="center">
        Developer Tools
      </Heading>
      <Flex m={2}>
        <Text m={2} fontSize={3} fontWeight={4}>
          ETH price:
        </Text>
        <Input ref={priceInputRef} type="number" defaultValue={price} />
        <Button
          ml={2}
          onClick={() => priceInputRef.current && liquity.setPrice(priceInputRef.current.value)}
        >
          Set
        </Button>
      </Flex>
      <Flex m={2} mt={4}>
        <Input
          ref={numberOfTrovesToLiquidateInputRef}
          type="number"
          defaultValue={10}
          step={1}
          min={1}
          mr={1}
        />
        <Button
          ml={1}
          width={1 / 2}
          onClick={() => {
            const numberOfTrovesToLiquidate = numberOfTrovesToLiquidateInputRef.current?.value;
            if (numberOfTrovesToLiquidate) {
              liquity.liquidate(parseInt(numberOfTrovesToLiquidate));
            }
          }}
        >
          Liquidate
        </Button>
      </Flex>
    </Box>
  );
};
