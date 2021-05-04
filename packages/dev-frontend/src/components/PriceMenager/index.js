import { useState, useEffect } from "react";
import cn from "classnames";

import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT, ETH } from "../../strings";

import classes from "./PriceManager.module.css";

const DATA = {
  liquity: {
    order: 2,
    currency: GT,
    icon: `${process.env.PUBLIC_URL}/icons/LQTY icon.png`
  },
  "liquity-usd": {
    order: 1,
    currency: COIN,
    icon: `${process.env.PUBLIC_URL}/icons/128-lusd-icon.svg`
  }
};

const DataRow = ({ currency, percentage, increase, amount, icon }) => (
  <div className={classes.item}>
    <div className={classes.row}>
      <div className={classes.currency}>{currency}</div>
      <div className={classes.icon}>
        <img src={icon} alt={currency} className={classes.iconImage} />
      </div>
    </div>
    <div className={classes.row}>
      <div className={classes.amount}>${amount}</div>
      <div className={classes.percentage}>{percentage}%</div>
      <div
        className={cn(classes.change, {
          [classes.decrease]: !increase
        })}
      >
        <ion-icon name="caret-up-outline"></ion-icon>
      </div>
    </div>
  </div>
);

const select = ({ price }) => ({ price });

const PriceManager = () => {
  const { price } = useLiquitySelector(select);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=liquity,ethereum,liquity-usd&vs_currencies=usd&include_24hr_change=true",
      {
        method: "GET"
      }
    )
      .then(res => res.json())
      .then(setData)
      .catch(console.warn);
  }, []);

  if (!data) return null;

  return (
    <div className={cn(classes.wrapper, "slide-in-left")}>
      <DataRow
        key={ETH}
        currency={ETH}
        icon={`${process.env.PUBLIC_URL}/icons/ethereum-eth.svg`}
        percentage={data.ethereum.usd_24h_change.toFixed(1).toString().replace("-", "")}
        increase={data.ethereum.usd_24h_change > 0}
        amount={price.prettify(2)}
      />
      {Object.keys(data)
        .filter(k => k !== "ethereum")
        .sort((a, b) => DATA[a].order - DATA[b].order)
        .map(c => (
          <DataRow
            key={c}
            currency={DATA[c].currency}
            icon={DATA[c].icon}
            percentage={data[c].usd_24h_change.toFixed(1).toString().replace("-", "")}
            increase={data[c].usd_24h_change > 0}
            amount={data[c].usd.toFixed(2)}
          />
        ))}
    </div>
  );
};

export default PriceManager;
