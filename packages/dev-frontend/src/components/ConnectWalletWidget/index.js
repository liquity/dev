import cn from "classnames";

import Button from "../Button";
import { Icon } from "../Icon";

import classes from "./ConnectWalletWidget.module.css";

export const ConnectWalletButton = ({ onClick }) => (
  <div className={classes.wrapper}>
    <Button secondary round uppercase className={classes.button} onClick={onClick}>
      <span className={classes.text}>Connect wallet</span>
      <Icon name="wallet" size="md" />
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

const ITEMS = [
  { text: "MetaMask", img: `${process.env.PUBLIC_URL}/icons/metamask.png` }
  // { text: "MetaMask", img: `${process.env.PUBLIC_URL}/icons/metamask.png` },
  // { text: "MetaMask", img: `${process.env.PUBLIC_URL}/icons/metamask.png` }
];

const WidgetItem = ({ dispatch, activate, injectedConnector, onItemClick, connected, ...i }) => (
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
    <p className={classes.itemContent}>{i.text}</p>
    <img src={i.img} alt={i.text} className={classes.itemIcon} />
  </div>
);

const ConnectWalletWidget = props => {
  return (
    <div className={classes.widget}>
      {ITEMS.map((i, n) => (
        <WidgetItem key={n} {...i} connected={props.connected} {...props} />
      ))}
    </div>
  );
};

export default ConnectWalletWidget;
