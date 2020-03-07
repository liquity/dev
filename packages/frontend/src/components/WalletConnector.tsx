import { Web3Provider } from "ethers/providers";
import React, { useEffect, useReducer } from "react";
import { useWeb3React } from "@web3-react/core";
import { MetaMaskButton, Modal, Text } from "rimble-ui";

import { useInjectedConnector } from "../hooks/connectors/InjectedConnector";
import { RetryDialog } from "./RetryDialog";
import { ConnectionConfirmationDialog } from "./ConnectionConfirmationDialog";
import { MetaMaskIcon } from "./MetaMaskIcon";

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
      if (state.type === "inactive") {
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

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({ children, loader }) => {
  const web3 = useWeb3React<Web3Provider>();

  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });
  const connectors = {
    injected: useInjectedConnector(web3)
  };

  useEffect(() => {
    if (web3.error) {
      dispatch({ type: "fail", error: web3.error });
    }
  }, [web3.error]);

  if (!connectors.injected.triedAuthorizedConnection) {
    return <>{loader}</>;
  }

  if (web3.active) {
    return <>{children}</>;
  }

  return (
    <>
      <MetaMaskButton onClick={() => dispatch({ type: "activate", connector: connectors.injected })}>
        Connect to MetaMask
      </MetaMaskButton>

      <Modal isOpen={connectionState.type === "activating"}>
        <ConnectionConfirmationDialog
          title="Confirm connection in MetaMask"
          icon={<MetaMaskIcon />}
          onCancel={() => dispatch({ type: "cancel" })}
        >
          <Text textAlign="center">
            Confirm the request that's just appeared. If you can't see a request, open your MetaMask
            extension via your browser.
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
