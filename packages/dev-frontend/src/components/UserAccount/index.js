import cn from "classnames";

import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";
import { useLiquity } from "../../hooks/LiquityContext";
import { shortenAddress } from "../../utils/shortenAddress";

import { Icon } from "../Icon";
import Button from "../Button";

import classes from "./UserAccount.module.css";

const select = ({ accountBalance, lusdBalance, lqtyBalance }) => ({
  accountBalance,
  lusdBalance,
  lqtyBalance
});

const UserAccount = ({ onWalletClick }) => {
  const { account } = useLiquity();
  const { accountBalance, lusdBalance, lqtyBalance } = useLiquitySelector(select);

  return (
    <div className={classes.wrapper}>
      <div className={classes.balances}>
        {[
          ["ETH", accountBalance],
          [COIN, lusdBalance],
          [GT, lqtyBalance]
        ].map(([currency, balance], i) => (
          <div className={classes.balance} key={i}>
            <span
              className={cn(classes.currency, {
                [classes.bold]: currency === "ETH"
              })}
            >
              {currency}
            </span>
            <span
              className={cn(classes.amount, {
                [classes.bold]: currency === "ETH"
              })}
            >
              {balance.prettify()}
            </span>
          </div>
        ))}
      </div>

      <Button className={classes.account} primary round onClick={onWalletClick}>
        <span className={classes.accountNum}>{shortenAddress(account)}</span>
        <span className={classes.walletIcon}>
          <Icon name="wallet" size="lg" />
        </span>
      </Button>
    </div>
  );
};

export default UserAccount;
