import { useState } from "react";
import { Switch, Route } from "react-router-dom";
import { Wallet } from "@ethersproject/wallet";

import { Decimal, Difference, Trove } from "@liquity/lib-base";
import { LiquityStoreProvider } from "@liquity/lib-react";

import { useLiquity } from "./hooks/LiquityContext";
import { TransactionMonitor } from "./components/Transaction";
import { shortenAddress } from "./utils/shortenAddress";

import { PageSwitcher } from "./pages/PageSwitcher";
import StabilityPool from "./pages/StabilityPool";
import Stake from "./pages/Stake";

import TroveViewProvider from "./components/TroveWidget/context/TroveViewProvider";
import { StabilityViewProvider } from "./components/Stability/context/StabilityViewProvider";
import { StakingViewProvider } from "./components/Staking/context/StakingViewProvider";
import { FarmViewProvider } from "./components/Farm/context/FarmViewProvider";
import Loader from "./components/Loader";
import Header from "./components/Header";
import Body from "./components/Body";
import KickbackRate from "./components/KickbackRate";
import SystemStats from "./components/SystemStats";
import PriceMenager from "./components/PriceMenager";
import UserAccount from "./components/UserAccount";
import Modal from "./components/Modal";
import Link from "./components/Link";
import CopyToClipboard from "./components/CopyToClipboard";
import Button from "./components/Button";

import classes from "./LiquityFrontend.module.css";

const loader = () => <Loader />;

const detectMetaMask = () => window.ethereum?.isMetaMask ?? false;

export const LiquityFrontend = () => {
  const [walletModal, setWalletModal] = useState(null);
  const { account, provider, liquity } = useLiquity();
  const isMetaMask = detectMetaMask();

  Object.assign(window, {
    account,
    provider,
    liquity,
    Trove,
    Decimal,
    Difference,
    Wallet
  });

  return (
    <LiquityStoreProvider lodaer={loader} store={liquity.store}>
      <TroveViewProvider>
        <StabilityViewProvider>
          <StakingViewProvider>
            <FarmViewProvider>
              {walletModal && (
                <Modal title={shortenAddress(account)} onClose={() => setWalletModal(null)}>
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
                    {isMetaMask ? "Connected with MetaMask" : "Connected with wallet"}{" "}
                    {isMetaMask && (
                      <img
                        className={classes.metaMaskIcon}
                        src={`${process.env.PUBLIC_URL}/icons/metamask.png`}
                        alt="MetaMask"
                      />
                    )}
                  </p>
                  <div className={classes.actions}>
                    <Button className={classes.fourthButton}>change</Button>
                    <Button
                      className={classes.fourthButton}
                      onClick={() => window.ethereum._handleDisconnect()}
                    >
                      disconnect
                    </Button>
                  </div>
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
                    <PageSwitcher />
                  </Route>

                  <Route path="/stability-pool">
                    <StabilityPool />
                  </Route>

                  <Route path="/stake">
                    <Stake />
                  </Route>

                  <Route path="/liquidation">
                    <div>liquidation</div>
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
