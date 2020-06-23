import React, { useEffect, useReducer } from "react";
import { useWeb3React } from "@web3-react/core";
import { Button, Text, Flex, Link, Box } from "theme-ui";

import { useInjectedConnector } from "../hooks/connectors/InjectedConnector";
import { RetryDialog } from "./RetryDialog";
import { ConnectionConfirmationDialog } from "./ConnectionConfirmationDialog";
import { MetaMaskIcon } from "./MetaMaskIcon";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface Connector {
  activate: () => Promise<void>;
  deactivate: () => void;
}

type ConnectionState =
  | { type: "inactive" }
  | { type: "activating" | "rejectedByUser" | "failed"; connector: Connector };

type ConnectionAction =
  | { type: "activate"; connector: Connector }
  | { type: "fail"; error: Error }
  | { type: "retry" | "cancel" };

const connectionReducer: React.Reducer<ConnectionState, ConnectionAction> = (state, action) => {
  switch (action.type) {
    case "activate":
      if (state.type === "inactive" || state.type === "failed") {
        action.connector.activate();
        return {
          type: "activating",
          connector: action.connector
        };
      }
      break;
    case "fail":
      if (state.type === "activating") {
        return {
          type: action.error.name === "UserRejectedRequestError" ? "rejectedByUser" : "failed",
          connector: state.connector
        };
      }
      break;
    case "retry":
      if (state.type === "rejectedByUser" || state.type === "failed") {
        state.connector.activate();
        return {
          type: "activating",
          connector: state.connector
        };
      }
      break;
    case "cancel":
      if (state.type === "activating") {
        state.connector.deactivate();
        return {
          type: "inactive"
        };
      }
      if (state.type === "rejectedByUser" || state.type === "failed") {
        return {
          type: "inactive"
        };
      }
      break;
  }

  throw new Error(`Cannot ${action.type} when ${state.type}`);
};

const detectMetaMask = () => window.ethereum?.isMetaMask ?? false;

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({ children, loader }) => {
  const web3React = useWeb3React<unknown>();

  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });
  const connectors = {
    injected: useInjectedConnector(web3React)
  };

  const isMetaMask = detectMetaMask();

  useEffect(() => {
    if (web3React.error) {
      dispatch({ type: "fail", error: web3React.error });
    }
  }, [web3React.error]);

  if (!connectors.injected.triedAuthorizedConnection) {
    return <>{loader}</>;
  }

  if (web3React.active) {
    return <>{children}</>;
  }

  return (
    <>
      <Flex sx={{ height: "100vh", justifyContent: "center", alignItems: "center" }}>
        <Button onClick={() => dispatch({ type: "activate", connector: connectors.injected })}>
          {isMetaMask ? (
            <>
              <MetaMaskIcon />
              <Box sx={{ ml: 2 }}>Connect to MetaMask</Box>
            </>
          ) : (
            <>
              <Icon name="plug" size="lg" />
              <Box sx={{ ml: 2 }}>Connect wallet</Box>
            </>
          )}
        </Button>
      </Flex>

      <Modal isOpen={connectionState.type === "failed"}>
        <RetryDialog
          title={isMetaMask ? "Failed to connect to MetaMask" : "Failed to connect wallet"}
          onRetry={() => dispatch({ type: "retry" })}
          onCancel={() => dispatch({ type: "cancel" })}
        >
          <Text sx={{ textAlign: "center" }}>
            You might need to install MetaMask or use a different browser.
          </Text>
          <Link sx={{ lineHeight: 3 }} href="https://metamask.io/download.html" target="_blank">
            Learn more <Icon size="xs" name="external-link-alt" />
          </Link>
        </RetryDialog>
      </Modal>

      <Modal isOpen={connectionState.type === "activating"}>
        <ConnectionConfirmationDialog
          title={isMetaMask ? "Confirm connection in MetaMask" : "Confirm connection in your wallet"}
          icon={isMetaMask ? <MetaMaskIcon /> : <Icon name="wallet" size="lg" />}
          onCancel={() => dispatch({ type: "cancel" })}
        >
          <Text sx={{ textAlign: "center" }}>
            Confirm the request that's just appeared.
            {isMetaMask ? (
              <> If you can't see a request, open your MetaMask extension via your browser.</>
            ) : (
              <> If you can't see a request, you might have to open your wallet.</>
            )}
          </Text>
        </ConnectionConfirmationDialog>
      </Modal>

      <Modal isOpen={connectionState.type === "rejectedByUser"}>
        <RetryDialog
          title="Cancel connection?"
          onCancel={() => dispatch({ type: "cancel" })}
          onRetry={() => dispatch({ type: "retry" })}
        >
          <Text>To use Liquity, you need to connect your Ethereum account.</Text>
        </RetryDialog>
      </Modal>
    </>
  );
};
