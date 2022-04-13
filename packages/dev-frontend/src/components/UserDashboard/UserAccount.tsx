import React, { useState, useRef } from "react";
import { Container, Text, Flex, Box, Button } from "theme-ui";

import { AccountInfo } from "./AccountInfo";
import { useLiquity } from "../../hooks/LiquityContext";
import { shortenAddress } from "../../utils/shortenAddress";
import { PriceManager } from "../../components/PriceManager";
import { TopSystemStats } from "../../components/TopSystemStats";
import { useWeb3React } from "../../hooks"
import { injected } from "../../connectors";

const UserModal: React.FC = () => {
    return (
        <Container variant="single" sx={{
            zIndex: 99,
            maxWidth: ["100%", "36em"],
        }}>
            <TopSystemStats filterStats={["aut-price", "lqty-price"]}/>
            <AccountInfo />
            <PriceManager />
        </Container>
    )
}

export const UserAccount: React.FC = () => {
    const { account } = useLiquity();
    const userModalOverlayRef = useRef<HTMLDivElement>(null);
    const [userModalOpen, setSystemStatsOpen] = useState(false);
    const { activate } = useWeb3React();


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
                                {account && shortenAddress(account)}
                            </Text>
                        </Flex>
                    </Button>
                </Flex>
            </Box>

            <Box>
                <Flex sx={{ mx: 2, alignItems: "center" }}>
                    {/* <Icon name="user-circle" size="lg" /> */}
                    <Button
                        onClick={() => activate(injected)
                        }
                        variant="colors"
                        sx={{ px: 30, py: 2 }}>
                        <Flex sx={{ flexDirection: "column" }}>
                            <Text as="span" sx={{ fontSize: 1 }}>
                                {account && shortenAddress(account)}
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

