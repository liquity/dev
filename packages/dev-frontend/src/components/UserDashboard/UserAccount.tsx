import React, { useState, useRef } from "react";
import { Container, Text, Flex, Box, Button } from "theme-ui";
import { UnsupportedChainIdError } from '@web3-react/core'
import { AccountInfo } from "./AccountInfo";
import { useLiquity, isWalletConnected } from "../../hooks/LiquityContext";
import { shortenAddress } from "../../utils/shortenAddress";
import { PriceManager } from "../../components/PriceManager";
import { TopSystemStats } from "../../components/TopSystemStats";
import { useWeb3React } from "../../hooks"
import { injected } from "../../connectors";
import { AbstractConnector } from '@web3-react/abstract-connector';

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

type AccountButtonProps = {
    account: string | null | undefined;
    userModalOpen: boolean;
    setSystemStatsOpen: React.Dispatch<React.SetStateAction<boolean>>;
    activate: (connector: AbstractConnector, onError?: ((error: Error) => void) | undefined, throwErrors?: boolean | undefined) => Promise<void>
};

const AccountButton: React.FC<AccountButtonProps> = props => {
    if(!isWalletConnected(props.account)) {
        return <Button
            onClick={() => props.activate(injected)}
            variant="colors"
            sx={{ px: 3, py: 2 }}>
            <Flex sx={{ flexDirection: "column" }}>
                <Text as="span" sx={{ fontSize: 1 }}>
                    🦊 Connect Wallet
                </Text>
            </Flex>
        </Button>
    } 
    return <Button
        onClick={() => props.setSystemStatsOpen(!props.userModalOpen) }
        variant="colors"
        sx={{ px: 3, py: 2 }}>
        <Flex sx={{ flexDirection: "column" }}>
            <Text as="span" sx={{ fontSize: 1 }}>
                {props.account && shortenAddress(props.account)}
            </Text>
        </Flex>
    </Button>
}

export const UserAccount: React.FC = () => {
    const { account } = useLiquity();
    const userModalOverlayRef = useRef<HTMLDivElement>(null);
    const [userModalOpen, setSystemStatsOpen] = useState(false);
    const { activate } = useWeb3React();

    const tryActivation = async (connector: AbstractConnector | undefined) => {
        connector &&
          activate(connector, undefined, true).catch(error => {
            if (error instanceof UnsupportedChainIdError) {
              activate(connector) // a little janky...can't use setError because the connector isn't set
            } else {
              console.error(error)
            }
          })
      }

    return (
        <>
            <Box>
                <Flex sx={{ mx: 2, alignItems: "center" }}>
                    {/* <Icon name="user-circle" size="lg" /> */}
                    <AccountButton 
                        account = {account}
                        setSystemStatsOpen = {setSystemStatsOpen}
                        userModalOpen = {userModalOpen}
                        activate={tryActivation}
                    ></AccountButton>
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

