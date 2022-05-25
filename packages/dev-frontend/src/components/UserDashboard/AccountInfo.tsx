import { Decimal, LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";
import { Text, Flex, Heading, Card, Button, Badge } from "theme-ui";
import { useLiquity } from "../../hooks/LiquityContext";

type tokenAddress = {
    symbol: string,
    address: string,
}

const addToken = async (token: tokenAddress) => {
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

const ProtocolTokens: React.FC = () => {
    const { liquity: { connection: { addresses } } } = useLiquity();

    const tokens: tokenAddress[] = [
        { symbol: "OUSD", address: addresses["lusdToken"] },
        { symbol: "OPAL", address: addresses["lqtyToken"] }
    ]

    return (
        <Flex sx={{ justifyContent: "center", flexDirection: "column", alignItems: "centeer", gap: 1}}>
            <Flex sx={{ alignItems: "center", justifyContent: "center" }}>
                {
                    tokens.map((token) => (
                        <Button
                            variant="token"
                            onClick={() => { addToken(token) }}
                            sx={{ py: 1, px: 2, mx: 2, fontSize: 1, border: 2 }}>
                            {token.symbol}
                        </Button>
                    ))
                }
            </Flex>
        </Flex>
    )
}

type tokenBalance = {
    symbol: string,
    balance: Decimal,
}

const balanceSelector = ({ accountBalance, lusdBalance, lqtyBalance }: LiquityStoreState) => ({
    accountBalance,
    lusdBalance,
    lqtyBalance
});

const TokenBalances: React.FC = () => {
    const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(balanceSelector);

    const tokens: tokenBalance[] = [
        { symbol: "AUT", balance: accountBalance },
        { symbol: "OUSD", balance: lusdBalance },
        { symbol: "OPAL", balance: lqtyBalance },
    ];


    return (
        <>
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
                <Text sx={{ fontSize: 2 }}>Available</Text>
                {
                    tokens.map((token, i) => (
                        <Flex key={i} sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}>
                            <Text sx={{ fontSize: 2, fontWeight: "bold" }}>{token.symbol}</Text>
                            <Text sx={{ fontSize: 2 }}>{token.balance.prettify()}</Text>
                        </Flex>
                    ))}
            </Flex>
        </>
    )
}

const AddressBadge: React.FC = () => {
    const { account } = useLiquity();
    return (
        <Flex sx={{
            justifyContent: "center",
            mx: 3,
            my: 3,
        }}>
            <Badge variant="outline" sx={{
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

    )
}

const positionsSelector = ({ stabilityDeposit, lqtyStake }: LiquityStoreState) => ({
    stabilityDeposit,
    lqtyStake
});


const AccountPositions: React.FC = () => {
    const { stabilityDeposit, lqtyStake } = useLiquitySelector(positionsSelector);

    return (
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
            <Text sx={{ fontSize: 2 }}>Staked</Text>
            <Flex sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}>
                <Text sx={{ fontSize: 2, fontWeight: "bold" }}>OUSD</Text>
                <Text>{stabilityDeposit.currentLUSD.prettify()}</Text>
            </Flex>
            <Flex sx={{ alignItems: "center", justifyContent: "space-between", my: 1 }}>
                <Text sx={{ fontSize: 2, fontWeight: "bold" }}>OPAL</Text>
                <Text>{lqtyStake.stakedLQTY.prettify()}</Text>
            </Flex>
        </Flex>
    )
}

export const AccountInfo: React.FC = () => {

    return (
        <>
            <Card variant="userAccountModal" sx={{ justifyContent: "center", borderColor: "muted" }}>
                <Heading sx={{ fontSize: 2 }}>Account</Heading>
                <AddressBadge />
                <ProtocolTokens />
                <TokenBalances />
                <AccountPositions />
            </Card>
        </>
    );
};


