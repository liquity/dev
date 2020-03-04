import React, { useState } from "react";
import { Field, Input, Button, Box } from "rimble-ui";

import { Liquity } from "@liquity/lib";
import { Decimalish } from "@liquity/lib/dist/utils";

type DeveloperToolsProps = {
  liquity: Liquity;
  price: Decimalish;
};

export const DeveloperTools: React.FC<DeveloperToolsProps> = ({ liquity, price }) => {
  const [newPrice, setNewPrice] = useState<string>(price.toString(2));

  return (
    <>
      <Box>
        <Field label="ETH price">
          <Input
            type="text"
            required
            value={newPrice}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPrice(e.target.value)}
          />
        </Field>
      </Box>
      <Button onClick={() => liquity.setPrice(newPrice)}>Set</Button>
    </>
  );
};
