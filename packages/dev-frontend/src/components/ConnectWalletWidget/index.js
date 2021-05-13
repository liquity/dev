import cn from "classnames";

import Button from "../Button";
import { Icon } from "../Icon";

import classes from "./ConnectWalletWidget.module.css";

export const ConnectWalletButton = ({ onClick }) => (
  <div className={classes.wrapper}>
    <Button secondary round uppercase className={classes.button} onClick={onClick}>
      <span className={classes.text}>Connect wallet</span>
      <Icon name="wallet" size="sm" />
    </Button>
    <div className={classes.icons}>
      <div className={classes.icon}>
        <img
          src={`${process.env.PUBLIC_URL}/icons/connect wallet.png`}
          alt="Connect wallet"
          className={cn(classes.iconContent, classes.backgroundWhite)}
        />
      </div>
      <div className={classes.icon}>
        <img
          src={`${process.env.PUBLIC_URL}/icons/coinbase.png`}
          alt="Coinbase"
          className={cn(classes.iconContent, classes.backgroundWhite)}
        />
      </div>
      <div className={classes.icon}>
        <img
          src={`${process.env.PUBLIC_URL}/icons/metamask.png`}
          alt="Connect wallet"
          className={classes.iconContent}
        />
      </div>
    </div>
  </div>
);

const Metamask = ({ dispatch, activate, injectedConnector, onItemClick, connected }) => (
  <div
    className={cn(classes.item, {
      [classes.itemConnected]: connected
    })}
    onClick={() => {
      onItemClick();
      window.ethereum._handleDisconnect();
      dispatch({ type: "setConnector", connector: injectedConnector });
      dispatch({ type: "startActivating" });
      activate(injectedConnector);
    }}
  >
    <p className={classes.itemContent}>Metamask</p>
    <img
      src={`${process.env.PUBLIC_URL}/icons/metamask.png`}
      alt="Metamask Icon"
      className={classes.itemIcon}
    />
  </div>
);

const WalletConnect = ({ dispatch, activate, walletConnectConnector, onItemClick, connected }) => (
  <div
    className={cn(classes.item, {
      [classes.itemConnected]: connected
    })}
    onClick={() => {
      onItemClick();
      window.ethereum._handleDisconnect();
      dispatch({ type: "setConnector", connector: walletConnectConnector });
      dispatch({ type: "startActivating" });
      activate(walletConnectConnector);
    }}
  >
    <p className={classes.itemContent}>WalletConnect</p>
    <img
      src={`${process.env.PUBLIC_URL}/icons/connect wallet.png`}
      alt="Wallet Connect"
      className={classes.itemIcon}
    />
  </div>
);

const WalletLink = ({ dispatch, activate, walletLinkConnector, onItemClick, connected }) => (
  <div
    className={cn(classes.item, {
      [classes.itemConnected]: connected
    })}
    onClick={() => {
      onItemClick();
      window.ethereum._handleDisconnect();
      dispatch({ type: "setConnector", connector: walletLinkConnector });
      dispatch({ type: "startActivating" });
      activate(walletLinkConnector);
    }}
  >
    <p className={classes.itemContent}>Coinbase</p>
    <img
      src={`${process.env.PUBLIC_URL}/icons/coinbase.png`}
      alt="CoinBase"
      className={classes.itemIcon}
    />
  </div>
);

const ConnectWalletWidget = props => {
  return (
    <div className={classes.widget}>
      <Metamask connected={props.connected} {...props} />
      <WalletConnect connected={props.connected} {...props} />
      <WalletLink connected={props.connected} {...props} />
    </div>
  );
};

export default ConnectWalletWidget;
