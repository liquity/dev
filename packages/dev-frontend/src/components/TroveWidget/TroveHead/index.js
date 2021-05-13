import { useState, useEffect, useCallback } from "react";
import cn from "classnames";

import { useLiquitySelector } from "@liquity/lib-react";
import { CRITICAL_COLLATERAL_RATIO, Decimal, Percent } from "@liquity/lib-base";
import { useLiquity } from "../../../hooks/LiquityContext";

import Button from "../../Button";
import Modal from "../../Modal";
import { Spinner } from "../../Loader";
import StaticRow from "../../StaticRow";
import { useTransactionFunction } from "../../Transaction";
import ErrorDescription from "../../ErrorDescription";
import { Amount } from "../../ActionDescription";
import { useMyTransactionState } from "../../Transaction";

import { COIN, ETH } from "../../../strings";

import classes from "./TroveHead.module.css";

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
        [classes.danger]: status === "danger"
      })}
    >
      {amount} {unit}
    </p>
  </div>
);

const selectActive = ({ trove, price, lusdBalance, blockTag, total }) => ({
  trove,
  price,
  lusdBalance,
  blockTag,
  total
});

const transactionIdPrefix = "trove-";
const transactionIdMatcher = new RegExp(`^${transactionIdPrefix}`);

let expandedTroveInfo = false;

const ActiveTrove = () => {
  const [cancelModal, setCancelModal] = useState(null);
  const { liquity, account } = useLiquity();
  const [expanded, setExpanded] = useState(expandedTroveInfo || false);
  const [loading, setLoading] = useState(false);
  const [troves, setTroves] = useState(null);
  const myTransactionState = useMyTransactionState(transactionIdMatcher);

  const { trove, price, lusdBalance, blockTag, total } = useLiquitySelector(selectActive);

  const collateralRatio = trove.collateralRatio(price);
  const collateralRatioPct = new Percent(collateralRatio).prettify();

  const [sendTransaction] = useTransactionFunction(
    "trove-closure",
    liquity.send.closeTrove.bind(liquity.send)
  );

  const fetchTroves = useCallback(() => {
    setLoading(true);

    liquity
      .getTroves(
        {
          first: 5000,
          sortedBy: "ascendingCollateralRatio",
          startingAt: 0
        },
        { blockTag }
      )
      .then(troves => {
        setTroves(troves);
        setLoading(false);
      });
  }, [blockTag, liquity]);

  useEffect(() => {
    if (myTransactionState.type === "confirmedOneShot") {
      fetchTroves();
    }
  }, [fetchTroves, myTransactionState]);

  useEffect(() => {
    fetchTroves();

    const id = setInterval(() => {
      fetchTroves();
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(id);
    };
  }, [fetchTroves]);

  const liquidationRisk = collateralRatio.mul(100).lt(150)
    ? "high"
    : collateralRatio.mul(100).gte(150) && collateralRatio.mul(100).lte(190)
    ? "medium"
    : "low";

  const userIndex = troves?.length && troves.findIndex(t => t.ownerAddress === account);
  let debtInFrontOfMe = Decimal.from(0);
  for (let i = 0; i < userIndex; i++) {
    debtInFrontOfMe = debtInFrontOfMe.add(troves[i].debt);
  }

  const debtInFrontPct = total.debt.mulDiv(
    100,
    debtInFrontOfMe.gt(0) ? debtInFrontOfMe : Decimal.from(1)
  );
  const redemptionRisk = debtInFrontPct.lt(5)
    ? "high"
    : debtInFrontPct.gte(5) && debtInFrontPct.lte(15)
    ? "medium"
    : "low";

  return (
    <div className={classes.activeTroveWrapper}>
      {cancelModal && (
        <Modal
          onClose={() => setCancelModal(null)}
          status="warning"
          title="Are you sure you want to 
close trove?"
          decline={{
            text: "Cancel",
            action: () => setCancelModal(null)
          }}
          confirm={{
            text: "Close trove",
            action: () => {
              setCancelModal(null);
              sendTransaction();
            },
            disabled: trove.debt.gt(lusdBalance)
          }}
        >
          <div className={classes.closeAmounts}>
            <StaticRow
              label="Withdraw"
              amount={trove.collateral.prettify(4)}
              unit={ETH}
              boldAmount
            />
            <StaticRow label="Repay" amount={trove.debt.prettify(2)} unit={COIN} boldAmount />

            {trove.debt.gt(lusdBalance) && (
              <ErrorDescription>
                The amount you're trying to repay exceeds your balance by{" "}
                <Amount>
                  {trove.debt.sub(lusdBalance).prettify(2)} {COIN}
                </Amount>
                .
              </ErrorDescription>
            )}
          </div>
        </Modal>
      )}

      <Heading className={classes.activeTroveHeading}>your trove</Heading>

      <Body>
        <div
          className={cn(classes.trove, {
            [classes.troveBorder]: expanded
          })}
        >
          <TroveInfo label="Collateral" amount={trove.collateral.prettify(2)} unit={ETH} />
          <TroveInfo
            label="Ratio"
            amount={collateralRatioPct}
            status={
              collateralRatio.gt(CRITICAL_COLLATERAL_RATIO)
                ? "success"
                : collateralRatio.gt(1.2)
                ? "warning"
                : collateralRatio.lte(1.2)
                ? "danger"
                : "muted"
            }
          />
          <TroveInfo label="Debt" amount={trove.debt.prettify(0)} unit={COIN} />
        </div>

        <div
          className={cn(classes.troveRisks, {
            [classes.troveRisksExpanded]: expanded
          })}
        >
          {loading ? (
            <div className={classes.spinner}>
              <Spinner />
            </div>
          ) : (
            <>
              <div className={classes.troveRisksLeft}>
                <p className={classes.troveRisksType}>Liquidation risk</p>
                <p
                  className={cn(classes.troveRisksChance, {
                    [classes.riskHigh]: liquidationRisk === "high",
                    [classes.riskMedium]: liquidationRisk === "medium",
                    [classes.riskLow]: liquidationRisk === "low"
                  })}
                >
                  {liquidationRisk}
                </p>
                <p className={classes.troveRisksInfo}>liquidation price</p>
                <p className={classes.troveRisksAmount}>
                  {trove.debt.mulDiv(1.1, trove.collateral).prettify()} $
                </p>
              </div>
              <div className={classes.troveRisksRight}>
                {" "}
                <p className={classes.troveRisksType}>Redemption risk</p>
                <p
                  className={cn(classes.troveRisksChance, {
                    [classes.riskHigh]: redemptionRisk === "high",
                    [classes.riskMedium]: redemptionRisk === "medium",
                    [classes.riskLow]: redemptionRisk === "low"
                  })}
                >
                  {redemptionRisk}
                </p>
                <p className={classes.troveRisksInfo}>debt in front of me</p>
                <p className={classes.troveRisksAmount}>
                  {debtInFrontOfMe.shorten()} {COIN}
                </p>
              </div>
            </>
          )}
        </div>

        <Button
          className={cn(classes.toggleExpandButton, {
            [classes.rotate]: expanded
          })}
          onClick={() => {
            setExpanded(!expanded);
            expandedTroveInfo = !expandedTroveInfo;
          }}
        >
          <ion-icon name="chevron-down-outline"></ion-icon>
        </Button>

        <Actions>
          <Button tertiary small onClick={() => setCancelModal(true)}>
            close trove
          </Button>
        </Actions>
      </Body>
    </div>
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
