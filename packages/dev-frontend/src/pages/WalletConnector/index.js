import { useEffect, useReducer, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { HashRouter as Switch, Route } from "react-router-dom";

import { injectedConnector } from "../../connectors/injectedConnector";
import { useAuthorizedConnection } from "../../hooks/useAuthorizedConnection";

import { Icon } from "../../components/Icon";
import Loader, { Spinner } from "../../components/Loader";
import Header from "../../components/Header";
import ConnectWalletWidget, { ConnectWalletButton } from "../../components/ConnectWalletWidget";
import Modal from "../../components/Modal";
import Link from "../../components/Link";
import { UnregisteredKickbackRate } from "../../components/KickbackRate";
import Body from "../../components/Body";
import Preview from "./Preview";

import classes from "./WalletConnector.module.css";

const connectionReducer = (state, action) => {
  switch (action.type) {
    case "startActivating":
      return {
        type: "activating",
        connector: action.connector
      };
    case "finishActivating":
      return {
        type: "active",
        connector: state.type === "inactive" ? injectedConnector : state.connector
      };
    case "fail":
      if (state.type !== "inactive") {
        return {
          type: action.error.message.match(/user rejected/i)
            ? "rejectedByUser"
            : action.error.message.match(/already pending/i)
            ? "alreadyPending"
            : "failed",
          connector: state.connector
        };
      }
      break;
    case "retry":
      if (state.type !== "inactive") {
        return {
          type: "activating",
          connector: state.connector
        };
      }
      break;
    case "cancel":
      return {
        type: "inactive"
      };
    case "deactivate":
      return {
        type: "inactive"
      };

    default:
      return state;
  }

  return state;
};

const detectMetaMask = () => window.ethereum?.isMetaMask ?? false;

const WalletConnector = ({ children }) => {
  const [walletModal, setWalletModal] = useState(null);

  const { activate, deactivate, active, error } = useWeb3React();
  const triedAuthorizedConnection = useAuthorizedConnection();
  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });
  const isMetaMask = detectMetaMask();

  useEffect(() => {
    if (error) {
      dispatch({ type: "fail", error });
      deactivate();
    }
  }, [error, deactivate]);

  useEffect(() => {
    if (active) {
      dispatch({ type: "finishActivating" });
    } else {
      dispatch({ type: "deactivate" });
    }
  }, [active]);

  if (!triedAuthorizedConnection) {
    return <Loader />;
  }

  if (connectionState.type === "active") {
    return <>{children}</>;
  }

  return (
    <>
      <Header>
        <ConnectWalletButton onClick={() => setWalletModal(true)} />
      </Header>

      <UnregisteredKickbackRate />
      <Body>
        <Switch>
          <Route path="/" exact>
            {/* TODO check what's this */}
            <Preview showModal={() => setWalletModal(true)} />
          </Route>
        </Switch>
      </Body>

      {walletModal && (
        <Modal title="Connect your wallet" onClose={() => setWalletModal(null)}>
          <ConnectWalletWidget
            activate={activate}
            dispatch={dispatch}
            injectedConnector={injectedConnector}
            onItemClick={() => setWalletModal(null)}
          />
        </Modal>
      )}

      {connectionState.type === "failed" && (
        <Modal
          onClose={() => setWalletModal(null)}
          title={isMetaMask ? "Failed to connect to MetaMask" : "Failed to connect wallet"}
          content={
            <>
              You might need to install MetaMask or use a different browser.{" "}
              <Link sx={{ lineHeight: 3 }} href="https://metamask.io/download.html" target="_blank">
                Learn more <Icon size="xs" name="external-link-alt" />
              </Link>
            </>
          }
          confirm={{
            text: "Retry",
            action: () => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }
          }}
          decline={{ text: "Cancel", action: () => dispatch({ type: "cancel" }) }}
          status="error"
        />
      )}

      {connectionState.type === "activating" && (
        <Modal
          onClose={() => setWalletModal(null)}
          title={isMetaMask ? "Confirm connection in MetaMask" : "Confirm connection in your wallet"}
          decline={{ action: () => dispatch({ type: "cancel" }), text: "Cancel" }}
          content={
            "Confirm the request that&apos;s just appeared." + isMetaMask
              ? " If you can't see a request, open your MetaMask extension via your browser."
              : " If you can't see a request, you might have to open your wallet."
          }
        >
          <div className={classes.confirmDialog}>
            <div className={classes.confirmSpinner}>
              <Spinner size={4} />
            </div>
            <p className={classes.confirmText}>
              Waiting for connection confirmation...
              <br />
              This won’t cost you any Ether
            </p>
          </div>
        </Modal>
      )}

      {connectionState.type === "rejectedByUser" && (
        <Modal
          onClose={() => setWalletModal(null)}
          title="Are you sure you want to cancel connection?"
          decline={{ text: "Cancel", action: () => dispatch({ type: "cancel" }) }}
          confirm={{
            text: "Retry",
            action: () => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }
          }}
          content="To use Liquity, you need to connect your Ethereum account."
          status="warning"
        />
      )}

      {connectionState.type === "alreadyPending" && (
        <Modal
          onClose={() => setWalletModal(null)}
          title="Connection already requested"
          decline={{ text: "Cancel", action: () => dispatch({ type: "cancel" }) }}
          confirm={{
            text: "Retry",
            action: () => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }
          }}
          content="Please check your wallet and accept the connection request before retrying."
          status="warning"
        ></Modal>
      )}
    </>
  );
};

export default WalletConnector;
