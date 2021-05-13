import { useLiquitySelector } from "@liquity/lib-react";
import { useLiquity } from "../../hooks/LiquityContext";
import { Decimal } from "@liquity/lib-base";

import Link from "../Link";
import { Staking } from "./views/Staking/Staking";
import { Adjusting } from "./views/Adjusting/Adjusting";
import { Disabled } from "./views/Disabled/Disabled";
import { useFarmView } from "./context/FarmViewContext";
import { useValidationState } from "./context/useValidationState";
import { Yield } from "./views/Yield";

import classes from "./Farm.module.css";

const uniLink = lusdAddress => `https://app.uniswap.org/#/add/ETH/${lusdAddress}`;

const headSelector = ({ remainingLiquidityMiningLQTYReward, totalStakedUniTokens }) => ({
  remainingLiquidityMiningLQTYReward,
  totalStakedUniTokens
});

const Head = ({ view }) => {
  const { remainingLiquidityMiningLQTYReward } = useLiquitySelector(headSelector);

  return (
    <div className={classes.head}>
      <div className={classes.total}>
        <p className={classes.totalStaked}>
          LQTY remaining {remainingLiquidityMiningLQTYReward.shorten()}
        </p>
        <Yield />
      </div>
      <h3 className={classes.title}>
        {view === "DISABLED" ? (
          <>
            Liquidity farming period has finished
            <br />
            There are no more LQTY rewards left to farm
          </>
        ) : (
          <>
            Earn LQTY by staking <br />
            Uniswap ETH/LUSD LP tokens
          </>
        )}
      </h3>
    </div>
  );
};

const Footer = ({ addresses }) => (
  <p className={classes.footer}>
    You can obtain LP tokens by adding liquidity to the
    <br />
    <Link href={uniLink(addresses["lusdToken"])} target="_blank" className={classes.footerLink}>
      ETH/LUSD pool on Uniswap. <ion-icon name="open-outline"></ion-icon>
    </Link>
  </p>
);

const renderBody = (view, props, hasApproved, dispatchEvent) => {
  switch (view) {
    case "INACTIVE":
    case "STAKING": {
      return <Staking {...props} hasApproved={hasApproved} dispatchEvent={dispatchEvent} />;
    }
    case "ACTIVE":
    case "ADJUSTING": {
      return <Adjusting {...props} dispatchEvent={dispatchEvent} />;
    }

    case "DISABLED": {
      return <Disabled {...props} dispatchEvent={dispatchEvent} />;
    }

    default:
      return null;
  }
};

export const Farm = props => {
  const { view, dispatchEvent } = useFarmView();
  const { hasApproved } = useValidationState(Decimal.from(0));
  const {
    liquity: {
      connection: { addresses }
    }
  } = useLiquity();

  return (
    <>
      <Head view={view} />
      {renderBody(view, props, hasApproved, dispatchEvent)}
      <Footer addresses={addresses} />
    </>
  );
};
