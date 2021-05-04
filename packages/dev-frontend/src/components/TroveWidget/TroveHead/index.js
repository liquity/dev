import { useCallback, useState } from "react";
import cn from "classnames";

import { useLiquitySelector } from "@liquity/lib-react";
import { CRITICAL_COLLATERAL_RATIO, Percent } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";

import Button from "../../Button";
import Modal from "../../Modal";
import StaticRow from "../../StaticRow";
import { useTransactionFunction } from "../../Transaction";

import { COIN, ETH } from "../../../strings";

import classes from "./TroveHead.module.css";

// LIQUIDATED

const Heading = ({ children, className }) => (
  <h3 className={cn(classes.heading, className)}>{children}</h3>
);

const Body = ({ children, className }) => (
  <div className={cn(classes.body, className)}>{children}</div>
);

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

const selectActive = ({ trove, price }) => ({ trove, price });

const ActiveTrove = ({ dispatchEvent, view }) => {
  const [cancelModal, setCancelModal] = useState(null);
  const { liquity } = useLiquity();

  const { trove, price } = useLiquitySelector(selectActive);

  const collateralRatioPct = new Percent(trove.collateralRatio(price)).prettify();

  const [sendTransaction] = useTransactionFunction(
    "trove-closure",
    liquity.send.closeTrove.bind(liquity.send)
  );

  return (
    <>
      {cancelModal && (
        <Modal
          onClose={() => setCancelModal(null)}
          status="warning"
          title="Are you sure you want to 
close trove?"
          decline={{ text: "Cancel", action: () => setCancelModal(null) }}
          confirm={{
            text: "Close trove",
            action: () => {
              setCancelModal(null);
              sendTransaction();
            }
          }}
        >
          <div className={classes.closeAmounts}>
            <StaticRow label="Repay" amount={trove.collateral.prettify(4)} unit={COIN} boldAmount />
            <StaticRow label="Withdraw" amount={trove.debt.prettify(2)} unit={ETH} boldAmount />
          </div>
        </Modal>
      )}
      <Heading className={classes.activeTroveHeading}>your trove</Heading>
      <Body>
        <div className={classes.trove}>
          <TroveInfo label="Collateral" amount={trove.collateral.prettify(2)} unit={ETH} />
          <TroveInfo
            label="Ratio"
            amount={collateralRatioPct}
            status={
              trove.collateral?.gt(CRITICAL_COLLATERAL_RATIO)
                ? "success"
                : trove.collateral?.gt(1.2)
                ? "warning"
                : trove.collateral?.lte(1.2)
                ? "danger"
                : "muted"
            }
          />
          <TroveInfo label="Debt" amount={trove.debt.prettify(0)} unit={COIN} />
        </div>
        <Actions>
          <Button tertiary small onClick={() => setCancelModal(true)}>
            close trove
          </Button>
        </Actions>
      </Body>
    </>
  );
};

const NoTrove = () => (
  <Body className={classes.noTroveBody}>You have no active troves. Deposit to open trove.</Body>
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
      return <ActiveTrove dispatchEvent={dispatchEvent} view={view} />;
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
