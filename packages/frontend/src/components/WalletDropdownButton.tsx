import React from "react";
import { Button, Text } from "theme-ui";

import { Icon } from "./Icon";

export const WalletDropdownButton: React.FC = () => (
  <Button variant="cardlike">
    <Icon name="user-circle" aria-label="Connected user" aria-hidden={false} />
    <Text sx={{ mx: 3 }}>0x70E...DDF</Text>
    <Icon name="caret-down" />
  </Button>
);
