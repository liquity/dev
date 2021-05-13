import cn from "classnames";

import { Decimal, Percent } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { InfoIcon } from "../InfoIcon";
import { COIN } from "../../strings";

import classes from "./SystemStats.module.css";

const Stat = ({ children, name, tooltip }) => (
  <div className={classes.stat}>
    <div className={classes.statName}>
      {name}
      {tooltip && <InfoIcon size="xs" tooltip={tooltip} />}
    </div>

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

  const recoveryMode = total.debt.mulDiv(1.5, total.collateral);

  return (
    <div className={cn(classes.wrapper, "slide-in-right")}>
      <div className={classes.heading}>Protocol stats</div>

      <Stat
        name="TVL"
        tooltip="The Total Value Locked (TVL) is the total value of Ether locked as collateral in the system, given in ETH and USD."
      >
        {total.collateral.shorten()} ETH ($
        {Decimal.from(total.collateral.mul(price)).shorten()})
      </Stat>

      <Stat name="Active troves" tooltip="The total number of active Troves in the system.">
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

      <Stat
        name="Recovery Mode ETH"
        tooltip="The Dollar value of ETH below which the Total Collateral Ratio will drop below 150% and the system will enter Recovery Mode"
      >
        {total.debt.mulDiv(1.5, total.collateral).prettify(0)} $
      </Stat>
    </div>
  );
};

export default SystemStats;
