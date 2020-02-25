import { Web3Provider } from "ethers/providers";
import React, { useState, useEffect } from "react";
import { useWeb3React } from '@web3-react/core';
import {
  Button,
  Box,
  Card,
  Flex,
  Heading,
  MetaMaskButton,
  Modal,
  Text
} from "rimble-ui";

import { useInjectedConnector } from "./connectors/InjectedConnector";

export default () => {
  const { active, error } = useWeb3React<Web3Provider>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const connectors = {
    injected: useInjectedConnector()
  };

  useEffect(() => {
    if (error)
    setErrorMessage(error.message);
  }, [error]);

  if (!connectors.injected.triedAuthorizedConnection) {
    // Display nothing for the very brief period while we try to activate the injected provider.
    // This is arguably better than flashing a loading message or spinner that is only visible
    // for a few milliseconds.
    return null;
  }

  if (active) {
    return <p>Connected to wallet.</p>;
  }

  return (
    <>
      <MetaMaskButton onClick={connectors.injected.activate}>
        Connect to MetaMask
      </MetaMaskButton>

      <Modal isOpen={errorMessage !== undefined}>
        <Card width={"420px"} p={0}>
          <Button.Text
            icononly
            icon={"Close"}
            color={"moon-gray"}
            position={"absolute"}
            top={0}
            right={0}
            mt={3}
            mr={3}
            onClick={() => setErrorMessage(undefined)}
          />

          <Box p={4} mb={3}>
            <Heading.h3>Error</Heading.h3>
            <Text>{errorMessage}</Text>
          </Box>

          <Flex
            px={4}
            py={3}
            borderTop={1}
            borderColor={"#E8E8E8"}
            justifyContent={"flex-end"}
          >
            <Button.Outline onClick={() => setErrorMessage(undefined)}>Dismiss</Button.Outline>
          </Flex>
        </Card>
      </Modal>
    </>
  );
}
