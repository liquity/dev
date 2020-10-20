import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";
import { Icon } from "./Icon";
import { COIN } from "../strings";

const select = ({ accountBalance, quiBalance }: LiquityStoreState) => ({
  accountBalance,
  quiBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useLiquity();
  const { accountBalance, quiBalance } = useLiquitySelector(select);

  return (
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
            <Text sx={{ mr: 3, fontSize: 1 }}>{accountBalance.prettify()} ETH</Text>
            <Text sx={{ fontSize: 1 }}>
              {quiBalance.prettify()} {COIN}
            </Text>
          </Flex>
        </Flex>
      </Flex>
    </Box>
  );
};
