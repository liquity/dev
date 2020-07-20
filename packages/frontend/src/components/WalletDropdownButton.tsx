import React from "react";
import { Button, Text, SxProps } from "theme-ui";

import { Icon } from "./Icon";
import { breakOnMobile } from "../utils/breakpoints";

export const WalletDropdownButton: React.FC<SxProps> = ({ sx }) => (
  <Button variant="cardlike" {...{ sx }}>
    <Icon name="user" aria-label="Connected user" aria-hidden={false} />
    <Text
      sx={{
        ...breakOnMobile({ mx: [1, 3], fontSize: ["0px", "unset"] }),
        lineHeight: "20px",
        transitionDuration: "0.33s"
      }}
    >
      0x70E...DDF
    </Text>
    <Icon name="caret-down" />
  </Button>
);
