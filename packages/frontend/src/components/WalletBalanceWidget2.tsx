import React from "react";
import { Flex, Text, Box, SxProps } from "theme-ui";

import { Icon } from "./Icon";

export const WalletBalanceWidget: React.FC<SxProps> = ({ sx }) => (
  <Flex
    sx={{
      alignItems: "center",
      fontSize: 3,
      lineHeight: 1.1,
      fontFamily: "heading",
      fontWeight: "medium",

      ...sx
    }}
  >
    <Icon name="wallet" size="sm" aria-label="Wallet balance" aria-hidden={false} />

    <Text sx={{ ml: 4, py: 5 }}>10.4527 ETH</Text>

    <Box sx={{ mx: 4, fontSize: "5px" }}>
      <Icon name="circle" size="xs" />
    </Box>

    <Text>278.10 LQTY</Text>
  </Flex>
);
