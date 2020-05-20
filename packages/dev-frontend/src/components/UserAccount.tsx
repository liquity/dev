import React from "react";
import { Text, Flex, Box, Heading, Icon } from "rimble-ui";

import { Decimal } from "@liquity/decimal";
import { shortenAddress } from "../utils/shortenAddress";
import { LiquityLogo } from "./LiquityLogo";

type UserAccountProps = {
  account: string;
  etherBalance: Decimal;
  quiBalance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ account, etherBalance, quiBalance }) => {
  return (
    <Flex
      px={5}
      py={2}
      justifyContent="space-between"
      bg="near-white"
      borderBottom="1px solid lightgrey"
    >
      <Flex alignItems="center" height="48px">
        <LiquityLogo height="32px" />
        <Box mx={3} width="0px" height="100%" borderLeft="1px solid lightgrey" />
        <Heading fontWeight={2}>Developer Interface (Beta)</Heading>
      </Flex>
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
    </Flex>
  );
};
