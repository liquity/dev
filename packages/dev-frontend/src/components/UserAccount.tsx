import React from "react";
import { Text, Flex, Box, Heading, Icon } from "rimble-ui";

import { Decimal } from "@liquity/decimal";
import { shortenAddress } from "../utils/shortenAddress";

type UserAccountProps = {
  account: string;
  etherBalance: Decimal;
  quiBalance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ account, etherBalance, quiBalance }) => {
  return (
    <Flex alignItems="center">
      <Icon name="AccountCircle" size="28px" />
      <Box ml={3} mr={4}>
        <Heading fontSize={1}>Connected as</Heading>
        <Text fontSize={1}>{shortenAddress(account)}</Text>
      </Box>
      <Icon name="AccountBalanceWallet" size="28px" />
      <Box ml={3}>
        <Heading fontSize={1}>Balance</Heading>
        <Text.span mr={3} fontSize={1}>
          {etherBalance.prettify()} ETH
        </Text.span>
        <Text.span fontSize={1}>{quiBalance.prettify()} LQTY</Text.span>
      </Box>
    </Flex>
  );
};
