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
      dispatch({ type: "startActivating", connector: injectedConnector });
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

// const WalletConnect = ({ walletConnectProvider, onItemClick, connected }) => (
//   <div
//     className={cn(classes.item, {
//       [classes.itemConnected]: connected
//     })}
//     onClick={async () => {
//       onItemClick();
//       try {
//         await walletConnectProvider.enable();
//       } catch (err) {
//         console.warn(err);
//       }
//     }}
//   >
//     <p className={classes.itemContent}>WalletConnect</p>
//     <img
//       src={`${process.env.PUBLIC_URL}/icons/connect wallet.png`}
//       alt="Wallet Connect"
//       className={classes.itemIcon}
//     />
//   </div>
// );

// const WalletLink = ({ walletLinkProvider, onItemClick, connected }) => (
//   <div
//     className={cn(classes.item, {
//       [classes.itemConnected]: connected
//     })}
//     onClick={async () => {
//       onItemClick();
//       walletLinkProvider
//         .enable()
//         .then(accounts => {
//           console.log(`User's address is ${accounts[0]}`);
//           // web3.eth.defaultAccount = accounts[0];
//         })
//         .catch(console.warn);
//     }}
//   >
//     <p className={classes.itemContent}>Coinbase</p>
//     <img
//       src={`${process.env.PUBLIC_URL}/icons/coinbase.png`}
//       alt="CoinBase"
//       className={classes.itemIcon}
//     />
//   </div>
// );

const ConnectWalletWidget = props => {
  return (
    <div className={classes.widget}>
      <Metamask connected={props.connected} {...props} />
      {/* <WalletConnect connected={props.connected} {...props} /> */}
      {/* <WalletLink connected={props.connected} {...props} /> */}
    </div>
  );
};

export default ConnectWalletWidget;
