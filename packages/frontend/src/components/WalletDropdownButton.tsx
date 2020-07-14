import React from "react";
import { Button, Text, SxProps } from "theme-ui";

import { Icon } from "./Icon";

export const WalletDropdownButton: React.FC<SxProps> = ({ sx }) => (
  <Button variant="cardlike" {...{ sx }}>
    <Icon name="user-circle" aria-label="Connected user" aria-hidden={false} />
    <Text sx={{ mx: 3 }}>0x70E...DDF</Text>
    <Icon name="caret-down" />
  </Button>
);
