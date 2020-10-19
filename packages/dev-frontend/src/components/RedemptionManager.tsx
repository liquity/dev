import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Spinner, Card, Heading } from "theme-ui";

import { Decimal } from "@liquity/decimal";
import { LiquityStoreState } from "@liquity/lib-base";
import { useSelector } from "@liquity/lib-react";

import { Transaction, useMyTransactionState } from "./Transaction";
import { LoadingOverlay } from "./LoadingOverlay";
import { EditableRow } from "./Editor";
import { Icon } from "./Icon";
import { useLiquity } from "../hooks/LiquityContext";

type RedemptionActionProps = {
  exchangedQui: Decimal;
  setExchangedQui: (exchangedQui: Decimal) => void;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
};

const selectForRedemptionAction = ({ price, quiBalance, numberOfTroves }: LiquityStoreState) => ({
  price,
  quiBalance,
  numberOfTroves
});

const RedemptionAction: React.FC<RedemptionActionProps> = ({
  exchangedQui,
  setExchangedQui,
  changePending,
  setChangePending
}) => {
  const { price, quiBalance, numberOfTroves } = useSelector(selectForRedemptionAction);
  const { liquity } = useLiquity();

  const myTransactionId = "redemption";
  const myTransactionState = useMyTransactionState(myTransactionId);
  const tentativelyConfirmed =
    (myTransactionState.type === "waitingForConfirmations" &&
      myTransactionState.confirmations > 0) ||
    myTransactionState.type === "confirmed";

  useEffect(() => {
    if (myTransactionState.type === "waitingForApproval") {
      setChangePending(true);
    } else if (myTransactionState.type === "failed" || myTransactionState.type === "cancelled") {
      setChangePending(false);
    } else if (tentativelyConfirmed) {
      setExchangedQui(Decimal.ZERO);
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setExchangedQui, tentativelyConfirmed]);

  if (exchangedQui.isZero) {
    return null;
  }

  const send = liquity.redeemCollateral.bind(liquity, exchangedQui, { price, numberOfTroves });

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
        requires={[[quiBalance.gte(exchangedQui), "You don't have enough LQTY"]]}
        {...{ send }}
      >
        <Button sx={{ mx: 2 }}>Exchange {exchangedQui.prettify()} LQTY</Button>
      </Transaction>
    </Flex>
  );
};

const selectPrice = ({ price }: LiquityStoreState) => price;

export const RedemptionManager: React.FC = () => {
  const price = useSelector(selectPrice);
  const [exchangedQui, setExchangedQui] = useState(Decimal.ZERO);
  const [changePending, setChangePending] = useState(false);

  const editingState = useState<string>();

  const edited = exchangedQui.nonZero !== undefined;

  return (
    <>
      <Card>
        <Heading>
          Redeem Collateral with LQTY
          {edited && !changePending && (
            <Button
              variant="titleIcon"
              sx={{ ":enabled:hover": { color: "danger" } }}
              onClick={() => setExchangedQui(Decimal.ZERO)}
            >
              <Icon name="history" size="lg" />
            </Button>
          )}
        </Heading>

        {changePending && <LoadingOverlay />}

        <Box>
          <EditableRow
            label="Exchange"
            inputId="redeem-exchange"
            amount={exchangedQui.prettify()}
            unit="LQTY"
            {...{ editingState }}
            editedAmount={exchangedQui.toString(2)}
            setEditedAmount={editedQui => setExchangedQui(Decimal.from(editedQui))}
          ></EditableRow>

          <EditableRow
            label="Redeem"
            inputId="redeem-eth"
            amount={exchangedQui.div(price).prettify(4)}
            unit="ETH"
            {...{ editingState }}
            editedAmount={exchangedQui.div(price).toString(4)}
            setEditedAmount={editedEth => setExchangedQui(Decimal.from(editedEth).mul(price))}
          ></EditableRow>
        </Box>
      </Card>

      <RedemptionAction {...{ exchangedQui, setExchangedQui, changePending, setChangePending }} />
    </>
  );
};
