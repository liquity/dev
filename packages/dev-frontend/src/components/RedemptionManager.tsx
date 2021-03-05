import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Spinner, Card, Heading } from "theme-ui";

import { Decimal, Percent, LiquityStoreState, MINIMUM_COLLATERAL_RATIO } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";
import { COIN } from "../strings";

import { Icon } from "./Icon";
import { Transaction, useMyTransactionState } from "./Transaction";
import { LoadingOverlay } from "./LoadingOverlay";
import { EditableRow, StaticRow } from "./Editor";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);

type RedemptionActionProps = {
  lusdAmount: Decimal;
  setLUSDAmount: (lusdAmount: Decimal) => void;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  maxRedemptionRate: Decimal;
};

const selectForRedemptionAction = ({ lusdBalance, total, price }: LiquityStoreState) => ({
  lusdBalance,
  total,
  price
});

const RedemptionAction: React.FC<RedemptionActionProps> = ({
  lusdAmount,
  setLUSDAmount,
  changePending,
  setChangePending,
  maxRedemptionRate
}) => {
  const { lusdBalance, total, price } = useLiquitySelector(selectForRedemptionAction);

  const {
    liquity: { send: liquity }
  } = useLiquity();

  const myTransactionId = "redemption";
  const myTransactionState = useMyTransactionState(myTransactionId);

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (myTransactionState.type === "confirmed") {
      setLUSDAmount(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setLUSDAmount]);

  if (lusdAmount.isZero) {
    return null;
  }

  const send = liquity.redeemLUSD.bind(liquity, lusdAmount, maxRedemptionRate);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex variant="layout.actions">
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex variant="layout.actions">
      <Transaction
        id={myTransactionId}
        requires={[
          [
            !total.collateralRatioIsBelowMinimum(price),
            `Can't redeem when total collateral ratio is less than ${mcrPercent}`
          ],
          [lusdBalance.gte(lusdAmount), `You don't have enough ${COIN}`]
        ]}
        {...{ send }}
      >
        <Button sx={{ mx: 2 }}>
          Exchange {lusdAmount.prettify()} {COIN}
        </Button>
      </Transaction>
    </Flex>
  );
};

const select = ({ price, fees, total }: LiquityStoreState) => ({ price, fees, total });

export const RedemptionManager: React.FC = () => {
  const { price, fees, total } = useLiquitySelector(select);
  const [lusdAmount, setLUSDAmount] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);
  const editingState = useState<string>();

  const edited = !lusdAmount.isZero;
  const ethAmount = lusdAmount.div(price);
  const redemptionRate = fees.redemptionRate(lusdAmount.div(total.debt));
  const feePct = new Percent(redemptionRate);
  const ethFee = ethAmount.mul(redemptionRate);
  const maxRedemptionRate = redemptionRate.add(0.001); // TODO slippage tolerance

  return (
    <>
      <Card>
        <Heading>
          Redeem {COIN} to get ETH
          {edited && !changePending && (
            <Button
              variant="titleIcon"
              sx={{ ":enabled:hover": { color: "danger" } }}
              onClick={() => setLUSDAmount(Decimal.ZERO)}
            >
              <Icon name="history" size="lg" />
            </Button>
          )}
        </Heading>

        {changePending && <LoadingOverlay />}

        <Box>
          <EditableRow
            label="Redeem"
            inputId="redeem-lusd"
            amount={lusdAmount.prettify()}
            unit={COIN}
            {...{ editingState }}
            editedAmount={lusdAmount.toString(2)}
            setEditedAmount={amount => setLUSDAmount(Decimal.from(amount))}
          />

          {edited && (
            <>
              <StaticRow
                label="Fee"
                inputId="redeem-fee"
                amount={ethFee.toString(4)}
                color="danger"
                pendingAmount={feePct.toString(2)}
                pendingColor="danger"
                unit="ETH"
              />

              <StaticRow
                label="Get"
                inputId="redeem-eth"
                amount={ethAmount.sub(ethFee).prettify(4)}
                unit="ETH"
              />
            </>
          )}
        </Box>
      </Card>

      <RedemptionAction
        {...{ lusdAmount, setLUSDAmount, changePending, setChangePending, maxRedemptionRate }}
      />
    </>
  );
};
