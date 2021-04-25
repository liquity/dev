import cn from "classnames";

import { Decimal, Percent } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import classes from "./SystemStats.module.css";

const Stat = ({ children, name }) => (
  <div className={classes.stat}>
    <div className={classes.statName}>{name}</div>
    <div className={classes.statValue}>{children}</div>
  </div>
);

const select = ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  frontend
}) => ({
  numberOfTroves,
  price,
  total,
  lusdInStabilityPool,
  borrowingRate,
  redemptionRate,
  totalStakedLQTY,
  kickbackRate: frontend.status === "registered" ? frontend.kickbackRate : null
});

const SystemStats = () => {
  const { numberOfTroves, price, lusdInStabilityPool, total, totalStakedLQTY } = useLiquitySelector(
    select
  );

  const lusdInStabilityPoolPct =
    total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
  const totalCollateralRatioPct = new Percent(total.collateralRatio(price));

  return (
    <div className={cn(classes.wrapper, "slide-in-right")}>
      <div className={classes.heading}>Protocol stats</div>

      <Stat
        name="TVL"
        tooltip="The Total Value Locked (TVL) is the total value of Ether locked as collateral in the system, given in ETH and USD."
      >
        {total.collateral.shorten()} ETH($
        {Decimal.from(total.collateral.mul(price)).shorten()})
      </Stat>

      <Stat name="Active trowes" tooltip="The total number of active Troves in the system.">
        {Decimal.from(numberOfTroves).prettify(0)}
      </Stat>

      <Stat
        name="Total Collateral Ratio"
        tooltip="The ratio of the Dollar value of the entire system collateral at the current ETH:USD price, to the entire system debt."
      >
        {totalCollateralRatioPct.prettify()}
      </Stat>

      <Stat name="LUSD supply" tooltip="The total LUSD minted by the Liquity Protocol.">
        {total.debt.shorten()}
      </Stat>

      {lusdInStabilityPoolPct && (
        <Stat
          name="LUSD in Stability Pool"
          tooltip="The total LUSD currently held in the Stability Pool, expressed as an amount and a fraction of the LUSD supply.
        "
        >
          {lusdInStabilityPool.shorten()}
        </Stat>
      )}

      <Stat
        name="Staked LQTY"
        tooltip="The total amount of LQTY that is staked for earning fee revenue."
      >
        {totalStakedLQTY.shorten()}
      </Stat>
    </div>
  );
};

export default SystemStats;

/* 
name="Borrowing Fee"
tooltip="The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in LUSD) and is part of a Trove's debt. The fee varies between 0.5% and 5% depending on LUSD redemption volumes."
 */

/* 
        name="Recovery Mode"
        tooltip="Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Trove can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Trove's debt. Operations are also restricted that would negatively impact the TCR."
 */
