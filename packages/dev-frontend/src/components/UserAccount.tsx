import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { Decimal } from "@liquity/decimal";
import { shortenAddress } from "../utils/shortenAddress";
import { Icon } from "./Icon";

type UserAccountProps = {
  account: string;
  etherBalance: Decimal;
  quiBalance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ account, etherBalance, quiBalance }) => (
  <Box sx={{ display: ["none", "flex"] }}>
    <Flex sx={{ alignItems: "center" }}>
      <Icon name="user-circle" size="lg" />
      <Flex sx={{ ml: 3, mr: 4, flexDirection: "column" }}>
        <Heading sx={{ fontSize: 1 }}>Connected as</Heading>
        <Text as="span" sx={{ fontSize: 1 }}>
          {shortenAddress(account)}
        </Text>
      </Flex>
    </Flex>

    <Flex sx={{ alignItems: "center" }}>
      <Icon name="wallet" size="lg" />
      <Flex sx={{ ml: 3, flexDirection: "column" }}>
        <Heading sx={{ fontSize: 1 }}>Balance</Heading>
        <Flex>
          <Text sx={{ mr: 3, fontSize: 1 }}>{etherBalance.prettify()} ETH</Text>
          <Text sx={{ fontSize: 1 }}>{quiBalance.prettify()} LQTY</Text>
        </Flex>
      </Flex>
    </Flex>
  </Box>
);
