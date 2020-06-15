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
  <Flex sx={{ alignItems: "center" }}>
    <Icon name="user-circle" size="lg" />
    <Box ml={3} mr={4}>
      <Heading sx={{ fontSize: 1 }}>Connected as</Heading>
      <Text sx={{ fontSize: 1 }}>{shortenAddress(account)}</Text>
    </Box>

    <Icon name="wallet" size="lg" />
    <Box ml={3}>
      <Heading sx={{ fontSize: 1 }}>Balance</Heading>
      <Text as="span" sx={{ mr: 3, fontSize: 1 }}>
        {etherBalance.prettify()} ETH
      </Text>
      <Text as="span" sx={{ fontSize: 1 }}>
        {quiBalance.prettify()} LQTY
      </Text>
    </Box>
  </Flex>
);
