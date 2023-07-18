import React from "react";
import { Text, Flex, Box, Heading } from "theme-ui";

import { StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

import { COIN, GT } from "../strings";
import { useStabilio } from "../hooks/StabilioContext";
import { shortenAddress } from "../utils/shortenAddress";

import { Icon } from "./Icon";

const select = ({ accountBalance, xbrlBalance, stblBalance }: StabilioStoreState) => ({
  accountBalance,
  xbrlBalance,
  stblBalance
});

export const UserAccount: React.FC = () => {
  const { account } = useStabilio();
  const { accountBalance, xbrlBalance, stblBalance } = useStabilioSelector(select);

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

        {([
          ["ETH", accountBalance],
          [COIN, xbrlBalance],
          [GT, stblBalance]
        ] as const).map(([currency, balance], i) => (
          <Flex key={i} sx={{ ml: 3, flexDirection: "column" }}>
            <Heading sx={{ fontSize: 1 }}>{currency}</Heading>
            <Text sx={{ fontSize: 1 }}>{balance.prettify()}</Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
};
