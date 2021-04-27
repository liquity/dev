import { useEffect, useState } from "react";
import cn from "classnames";

import { Decimal, Percent, MINIMUM_COLLATERAL_RATIO } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../strings";

import { LoadingOverlay } from "../LoadingOverlay";
import StaticRow from "../StaticRow";
import { Amount } from "../ActionDescription";
import ErrorDescription from "../ErrorDescription";
import { useMyTransactionState } from "../Transaction";
import Input from "../Input";
import RedemptionAction from "./RedemptionAction";

import classes from "./Redemption.module.css";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);

const select = ({ price, fees, total, lusdBalance }) => ({
  price,
  fees,
  total,
  lusdBalance
});

const transactionId = "redemption";

const validateRedemption = ({ total, price, lusdAmount, lusdBalance }) =>
  total.collateralRatioIsBelowMinimum(price)
    ? [
        false,
        <ErrorDescription>
          You can't redeem LUSD when the total collateral ratio is less than{" "}
          <Amount>{mcrPercent}</Amount>. Please try again later.
        </ErrorDescription>
      ]
    : lusdAmount.gt(lusdBalance)
    ? [
        false,
        <ErrorDescription>
          The amount you're trying to redeem exceeds your balance by{" "}
          <Amount>
            {lusdAmount.sub(lusdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [true, undefined];

const RedemptionManager = () => {
  const { price, fees, total, lusdBalance } = useLiquitySelector(select);
  const [value, setValue] = useState("");
  const [lusdAmount, setLUSDAmount] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);

  const dirty = !lusdAmount.isZero;
  const ethAmount = lusdAmount.div(price);
  const redemptionRate = fees.redemptionRate(lusdAmount.div(total.debt));
  const feePct = new Percent(redemptionRate);
  const ethFee = ethAmount.mul(redemptionRate);
  const maxRedemptionRate = redemptionRate.add(0.001);

  const myTransactionState = useMyTransactionState(transactionId);

  useEffect(() => {
    if (
      myTransactionState.type === "waitingForApproval" ||
      myTransactionState.type === "waitingForConfirmation"
    ) {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (myTransactionState.type === "confirmed") {
      setLUSDAmount(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setLUSDAmount]);

  const [canRedeem, description] = validateRedemption({ total, price, lusdAmount, lusdBalance });

  return (
    <div className={classes.wrapper}>
      <Input
        label="redeem"
        value={value}
        placeholder={lusdAmount.prettify()}
        maxAmount={lusdBalance.toString()}
        maxedOut={lusdAmount.eq(lusdBalance)}
        unit={COIN}
        available={`Wallet ${lusdBalance.prettify(2)}`}
        onChange={v => {
          setValue(v);
          setLUSDAmount(Decimal.from(v || 0));
        }}
        step={100}
        min={0}
        icon={process.env.PUBLIC_URL + "/icons/ethereum-eth.svg"}
        autoFocus
      />

      {description}

      <div className={classes.action}>
        <RedemptionAction
          transactionId={transactionId}
          disabled={!dirty || !canRedeem}
          lusdAmount={lusdAmount}
          maxRedemptionRate={maxRedemptionRate}
        />
      </div>

      {value && (
        <div className={classes.info}>
          <StaticRow
            className={classes.staticRowInfo}
            label="Redemption Fee"
            inputId="redeem-fee"
            amount={ethFee.toString(4)}
            pendingAmount={feePct.toString(2)}
            unit="ETH"
          />

          <StaticRow
            className={cn(classes.staticRowInfo, classes.boldStaticRowInfo)}
            label="Recieve"
            inputId="recieve"
            amount={ethAmount.sub(ethFee).prettify(4)}
            unit="ETH"
            bold
          />
        </div>
      )}

      {changePending && <LoadingOverlay />}
    </div>
  );
};

export default RedemptionManager;
