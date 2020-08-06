import React from "react";
import { Flex, Text } from "theme-ui";

import { Icon } from "./Icon";

export const WalletBalanceWidget: React.FC = () => (
  <Flex
    sx={{
      alignItems: "center",
      fontSize: 3,
      lineHeight: 1.1
    }}
  >
    <Icon name="wallet" size="lg" aria-label="Wallet balance" aria-hidden={false} />

    <Text
      sx={{
        ml: 5,
        my: -5,
        fontSize: "0.9em",
        fontFamily: "heading",
        fontWeight: "medium"
      }}
    >
      <div>10.4527 ETH</div>
      <div>278.10 LQTY</div>
    </Text>
  </Flex>
);
