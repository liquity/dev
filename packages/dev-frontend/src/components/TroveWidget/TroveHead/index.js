import { useCallback } from "react";
import cn from "classnames";

import { useLiquitySelector } from "@liquity/lib-react";
import { CRITICAL_COLLATERAL_RATIO, Percent } from "@liquity/lib-base";

import Button from "../../Button";

import { COIN, ETH } from "../../../strings";

import classes from "./TroveHead.module.css";

// LIQUIDATED

const Heading = ({ children }) => <h3 className={classes.heading}>{children}</h3>;

const Body = ({ children }) => <div className={classes.body}>{children}</div>;

const Actions = ({ children }) => <div className={classes.actions}>{children}</div>;

const TroveInfo = ({ label, amount, status = null, unit }) => (
  <div className={classes.troveInfo}>
    <p className={classes.troveLabel}>{label}</p>
    <p
      className={cn(classes.troveAmount, {
        [classes.status]: status,
        [classes.success]: status === "success",
        [classes.warning]: status === "warning",
        [classes.warning]: status === "danger"
      })}
    >
      {amount} {unit}
    </p>
  </div>
);

const selectActive = ({ trove, price, total }) => ({ trove, price, total });

const ActiveTrove = ({ dispatchEvent }) => {
  const handleCloseTrove = useCallback(() => {
    dispatchEvent("CLOSE_TROVE_PRESSED");
  }, [dispatchEvent]);

  const { trove, price, total } = useLiquitySelector(selectActive);

  const collateralRatio = total.collateralRatio(price);
  const collateralRatioPct = new Percent(collateralRatio).prettify();

  return (
    <>
      <Heading>Active trove</Heading>
      <Body>
        <div className={classes.trove}>
          <TroveInfo label="Collateral" amount={trove.collateral.prettify(2)} unit={ETH} />
          <TroveInfo
            label="Ratio"
            amount={collateralRatioPct}
            status={
              collateralRatio?.gt(CRITICAL_COLLATERAL_RATIO)
                ? "success"
                : collateralRatio?.gt(1.2)
                ? "warning"
                : collateralRatio?.lte(1.2)
                ? "danger"
                : "muted"
            }
          />
          <TroveInfo label="Debt" amount={trove.debt.prettify(0)} unit={COIN} />
        </div>
        <Actions>
          <Button tertiary small onClick={handleCloseTrove}>
            close trove
          </Button>
        </Actions>
      </Body>
    </>
  );
};

const NoTrove = () => (
  <>
    <Heading>You haven't borrowed any LUSD yet</Heading>
    <Body>You can borrow LUSD by opening a Trove.</Body>
  </>
);

const selectSurplus = ({ collateralSurplusBalance }) => ({
  hasSurplusCollateral: !collateralSurplusBalance.isZero
});

const RedeemedTrove = () => {
  const { hasSurplusCollateral } = useLiquitySelector(selectSurplus);

  return (
    <>
      <Heading>Your Trove has been redeemed</Heading>
      <Body>
        {hasSurplusCollateral
          ? "Please reclaim your remaining collateral before opening a new Trove."
          : "You can borrow LUSD by opening a Trove."}
      </Body>
    </>
  );
};

const LiquidatedTrove = () => {
  const { hasSurplusCollateral } = useLiquitySelector(selectSurplus);

  return (
    <>
      <Heading>Your Trove has been redeemed</Heading>
      <Body>
        {hasSurplusCollateral
          ? "Please reclaim your remaining collateral before opening a new Trove."
          : "You can borrow LUSD by opening a Trove."}
      </Body>
    </>
  );
};

const render = (view, dispatchEvent) => {
  switch (view) {
    case "CLOSING":
    case "ACTIVE":
    case "ADJUSTING":
      return <ActiveTrove dispatchEvent={dispatchEvent} />;
    case "REDEEMED":
      return <RedeemedTrove />;
    case "LIQUIDATED":
      return <LiquidatedTrove />;
    case "OPENING":
    case "NONE":
      return <NoTrove />;
    default:
      return null;
  }
};

const TroveHead = ({ view, dispatchEvent }) => (
  <div className={classes.wrapper}>{render(view, dispatchEvent)}</div>
);

export default TroveHead;
