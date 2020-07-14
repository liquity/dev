import React from "react";
import { Flex, Text, Box } from "theme-ui";

import { Icon } from "./Icon";

export const WalletBalanceWidget: React.FC = () => (
  <Flex
    sx={{
      mx: 7,
      alignItems: "center",
      fontSize: 3,
      lineHeight: 1.1,
      fontFamily: "heading",
      fontWeight: "body"
    }}
  >
    <Icon name="wallet" size="sm" aria-label="Wallet balance" aria-hidden={false} />

    <Text sx={{ ml: 4 }}>10.4527</Text>

    <Box sx={{ mx: 4, fontSize: "5px" }}>
      <Icon name="circle" size="xs" />
    </Box>

    <Text>ETH 278.10 LQTY</Text>
  </Flex>
);
