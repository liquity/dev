import React from "react";
import { Text, Flex, Box, Badge } from "theme-ui";

// import { LiquityStoreState } from "@liquity/lib-base";
// import { useLiquitySelector } from "@liquity/lib-react";

// import { COIN, GT } from "../strings";
import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";
// import { Badge } from "../components/Badge";

// import { Icon } from "./Icon";

// const select = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
//     accountBalance,
//     lusdBalance,
//     lqtyBalance
// });

export const UserAccount: React.FC = () => {
    const { account } = useLiquity();
    // const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(select);

    return (
        <Box sx={{ display: ["none", "flex"] }}>
            <Flex sx={{ mx: 2, alignItems: "center" }}>
                {/* <Icon name="user-circle" size="lg" /> */}
                <Badge variant="colors">
                    <Flex sx={{ p: 1, flexDirection: "column" }}>
                        {/* <Heading sx={{ fontSize: 1 }}>Connected as</Heading> */}
                        <Text as="span" sx={{ fontSize: 1 }}>
                            {shortenAddress(account)}
                        </Text>
                    </Flex>
                </Badge>
            </Flex>

            <Flex sx={{ alignItems: "center" }}>
                {/* <Icon name="wallet" size="lg" /> */}

                {/* TODO: Add action to add token to metamask watchlist on click
                {([
                    ["ETH", accountBalance],
                    [COIN, lusdBalance],
                    [GT, lqtyBalance]
                ] as const).map(([currency], i) => (
                    <Flex key={i} sx={{ ml: 3, flexDirection: "column" }}>
                        <Heading sx={{ fontSize: 1 }}>{currency}</Heading>
                        <Text sx={{ fontSize: 1 }}>{balance.prettify()}</Text>
                    </Flex>
                ))}
                */}
            </Flex>
        </Box>
    );
};
