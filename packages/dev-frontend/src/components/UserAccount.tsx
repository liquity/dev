import React, { useState, useRef } from "react";
import { Container, Text, Flex, Heading, Card, Box, Button, Badge } from "theme-ui";
import { Decimal, LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { shortenAddress } from "../utils/shortenAddress";
import { PriceManager } from "../components/PriceManager";

const select = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
    accountBalance,
    lusdBalance,
    lqtyBalance
});

type token = {
    symbol: string,
    balance: Decimal,
    address?: string,
}

const addToken = async (token: token) => {
    try {
        (window as any).ethereum?.request({
            method: "wallet_watchAsset",
            params: {
                type: "ERC20",
                options: {
                    address: token.address,
                    symbol: token.symbol,
                    decimals: 18,
                },
            },
        })
    } catch (e) {
        console.log(e);
    }
}

const AccountInfo: React.FC = () => {
    const { account, liquity: { connection: { addresses } } } = useLiquity();
    const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(select);

    const tokens: token[] = [
        { symbol: "AUT", balance: accountBalance },
        { symbol: "LUSD", balance: lusdBalance, address: addresses["lusdToken"] },
        { symbol: "LQTY", balance: lqtyBalance, address: addresses["lqtyToken"] },
    ];

    return (
        <>
            <Card variant="userAccountModal" sx={{ justifyContent: "center" }}>
                <Heading sx={{ fontSize: 2 }}>Account</Heading>
                <Flex sx={{
                    justifyContent: "center",
                    mx: 3,
                    my: 3,
                }}>
                    <Badge variant="muted" sx={{
                        px: 3,
                        py: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        }}>
                    <Text>
                        {account}
                    </Text>
                </Badge>
            </Flex>
            <Flex sx={{
                justifyContent: "center",
                mt: 3,
                mb: 1,
                p: 2,
                borderRadius: 16,
                border: 1,
                borderColor: "muted",
                flexDirection: "column",
            }}>
                {
                    tokens.map((token, i) => (
                        <Flex key={i} sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}>
                            <Button
                                variant="token"
                                onClick={() => { if (token.address) { addToken(token) } }}
                                sx={{ p: 0, px: 2, mx: 2, fontSize: 1 }}>{token.symbol}</Button>
                            <Text sx={{ fontSize: 2 }}>{token.balance.prettify()}</Text>
                        </Flex>
                    ))}
            </Flex>
        </Card>
        </>
    );
};

const UserModal: React.FC = () => {
    return (
        <Container variant="single" sx={{
            zIndex: 99,
            maxWidth: ["100%", "36em"],
        }}>
            <AccountInfo />
            <PriceManager />
        </Container>
    )
}

export const UserAccount: React.FC = () => {
    const { account } = useLiquity();
    const userModalOverlayRef = useRef<HTMLDivElement>(null);
    const [userModalOpen, setSystemStatsOpen] = useState(false);

    return (
        <>
            <Box>
                <Flex sx={{ mx: 2, alignItems: "center" }}>
                    {/* <Icon name="user-circle" size="lg" /> */}
                    <Button
                        onClick={() => setSystemStatsOpen(!userModalOpen)}
                        variant="colors"
                        sx={{ px: 3, py: 2 }}>
                        <Flex sx={{ flexDirection: "column" }}>
                            <Text as="span" sx={{ fontSize: 1 }}>
                                {shortenAddress(account)}
                            </Text>
                        </Flex>
                    </Button>
                </Flex>
            </Box>

            {userModalOpen && (
                <Container
                    variant="userOverlay"
                    sx={{
                        // display: ["none", "flex"],
                    }}
                    ref={userModalOverlayRef}
                    onClick={e => {
                        if (e.target === userModalOverlayRef.current) {
                            setSystemStatsOpen(false);
                        }
                    }}
                >
                    <UserModal />
                    <Container variant="blurFilter" />
                </Container>
            )}
        </>
    )
};

