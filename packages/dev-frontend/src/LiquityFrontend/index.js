import { useState, useReducer, useEffect } from "react";
import { Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";
import { useWeb3React } from "@web3-react/core";

import { Decimal, Difference, Trove } from "@liquity/lib-base";
import { LiquityStoreProvider } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { TransactionMonitor } from "../components/Transaction";
import { shortenAddress } from "../utils/shortenAddress";

import StabilityPool from "../pages/StabilityPool";
import Stake from "../pages/Stake";
import Liquidation from "../pages/Liquidation";
import TrovePage from "../pages/Trove";

import TroveViewProvider from "../components/TroveWidget/context/TroveViewProvider";
import { StabilityViewProvider } from "../components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "../components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "../components/Farm/context/FarmViewProvider";
import Loader from "../components/Loader";
import Header from "../components/Header";
import Body from "../components/Body";
import KickbackRate from "../components/KickbackRate";
import SystemStats from "../components/SystemStats";
import PriceMenager from "../components/PriceMenager";
import UserAccount from "../components/UserAccount";
import Modal from "../components/Modal";
import Link from "../components/Link";
import CopyToClipboard from "../components/CopyToClipboard";
import Button from "../components/Button";
import ConnectWalletWidget from "../components/ConnectWalletWidget";
import { walletLinkConnector } from "../connectors/coinbase";
import { injectedConnector } from "../connectors/injectedConnector";
import { walletConnectConnector } from "../connectors/walletConnect";

import classes from "./LiquityFrontend.module.css";

const connectionReducer = (state, action) => {
  switch (action.type) {
    case "setConnector":
      return {
        ...state,
        connector: action.connector
      };

    case "startActivating":
      return {
        ...state,
        type: "activating"
      };

    case "finishActivating":
      return {
        ...state,
        type: "active"
      };

    case "fail":
      if (state.type !== "inactive") {
        return {
          type: action.error.message.match(/rejected/i)
            ? "rejectedByUser"
            : action.error.message.match(/pending/i)
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
        type: "inactive",
        connector: state.connector
      };

    case "deactivate":
      return {
        type: "inactive",
        connector: state.connector
      };

    default:
      return state;
  }

  return state;
};

const loader = () => <Loader />;

const detectMetaMask = () => window.ethereum?.isMetaMask ?? false;

export const LiquityFrontend = () => {
  const [walletModal, setWalletModal] = useState(null);
  const [changeWalletModal, setChangeWalletModal] = useState(null);
  const { activate, deactivate, active, error, connector } = useWeb3React();
  const { account, provider, liquity } = useLiquity();
  const [connectionState, dispatch] = useReducer(connectionReducer, {
    type: "inactive",
    connector: connector
  });
  const isMetaMask = detectMetaMask();
  const isMetamaskConnection = isMetaMask && connector === injectedConnector;

  Object.assign(window, {
    account,
    provider,
    liquity,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  useEffect(() => {
    if (connectionState.type === "rejectedByUser") {
      deactivate();
    }
    if (error) {
      dispatch({ type: "fail", error });
      deactivate();
    }
  }, [error, deactivate, connectionState]);

  useEffect(() => {
    if (active) {
      dispatch({ type: "finishActivating" });
    } else {
      dispatch({ type: "deactivate" });
      deactivate();
    }
  }, [active, deactivate]);

  return (
    <LiquityStoreProvider lodaer={loader} store={liquity.store}>
      <TroveViewProvider>
        <StabilityViewProvider>
          <StakingViewProvider>
            <FarmViewProvider>
              {walletModal && (
                <Modal title={shortenAddress(account)} onClose={() => setWalletModal(null)}>
                  <div>
                    <div className={classes.do}>
                      <CopyToClipboard className={classes.doButton} text={account}>
                        <span>copy address</span>
                        <ion-icon name="copy-outline"></ion-icon>
                      </CopyToClipboard>
                      <Link
                        className={classes.doButton}
                        href={`https://kovan.etherscan.io/address/${account}`}
                      >
                        <span>view on Etherscan</span>
                        <ion-icon name="open-outline"></ion-icon>
                      </Link>
                    </div>
                    <p className={classes.connection}>
                      {isMetamaskConnection ? "Connected with MetaMask" : "Connected"}{" "}
                      {isMetamaskConnection && (
                        <img
                          className={classes.metaMaskIcon}
                          src={`${process.env.PUBLIC_URL}/icons/metamask.png`}
                          alt="MetaMask"
                        />
                      )}
                    </p>
                    <div className={classes.actions}>
                      <Button
                        onClick={() => {
                          setWalletModal(false);
                          setChangeWalletModal(true);
                        }}
                        className={classes.fourthButton}
                      >
                        change
                      </Button>
                      <Button
                        className={classes.fourthButton}
                        onClick={() => window.ethereum._handleDisconnect()}
                      >
                        disconnect
                      </Button>
                    </div>
                  </div>
                </Modal>
              )}

              {changeWalletModal && (
                <Modal title="Change your wallet" onClose={() => setChangeWalletModal(null)}>
                  <ConnectWalletWidget
                    activate={activate}
                    deactivate={deactivate}
                    dispatch={dispatch}
                    injectedConnector={injectedConnector}
                    walletConnectConnector={walletConnectConnector}
                    walletLinkConnector={walletLinkConnector}
                    onItemClick={() => setChangeWalletModal(null)}
                  />
                </Modal>
              )}

              <Header>
                <UserAccount onWalletClick={() => setWalletModal(true)} />
              </Header>

              <KickbackRate />
              <SystemStats />
              <PriceMenager />

              <Body>
                <Switch>
                  <Route path="/" exact>
                    <TrovePage />
                  </Route>

                  <Route path="/stability-pool">
                    <StabilityPool />
                  </Route>

                  <Route path="/stake">
                    <Stake />
                  </Route>

                  <Route path="/liquidation">
                    <Liquidation />
                  </Route>
                </Switch>
              </Body>
            </FarmViewProvider>
          </StakingViewProvider>
        </StabilityViewProvider>
      </TroveViewProvider>
      <TransactionMonitor />
    </LiquityStoreProvider>
  );
};
