import React, { useState } from "react";
import { Text, Input, Button, Flex } from "rimble-ui";

import { Liquity } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";

type DeveloperToolsProps = {
  liquity: Liquity;
  price: Decimal;
};

export const DeveloperTools: React.FC<DeveloperToolsProps> = ({ liquity, price }) => {
  const [newPrice, setNewPrice] = useState<string>(price.toString());

  return (
    <>
      <Flex m={2}>
        <Text m={2} fontSize={3} fontWeight={4}>
          ETH price:
        </Text>
        <Input
          type="text"
          required
          value={newPrice}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPrice(e.target.value)}
        />
        <Button ml={2} onClick={() => liquity.setPrice(newPrice)}>
          Set
        </Button>
      </Flex>
      <Flex m={2} mt={4}>
        <Button mr={1} width={1 / 2} onClick={() => liquity.liquidate(1)}>
          Liquidate 1
        </Button>
        <Button ml={1} width={1 / 2} onClick={() => liquity.liquidate(10)}>
          Liquidate 10
        </Button>
      </Flex>
    </>
  );
};
