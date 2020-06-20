import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Spinner, Card, Heading } from "theme-ui";

import { Decimal } from "@liquity/decimal";
import { Liquity } from "@liquity/lib";
import { Transaction, useMyTransactionState } from "./Transaction";
import { LoadingOverlay } from "./LoadingOverlay";
import { EditableRow } from "./Editor";
import { Icon } from "./Icon";

type RedemptionActionProps = {
  liquity: Liquity;
  price: Decimal;
  exchangedQui: Decimal;
  setExchangedQui: (exchangedQui: Decimal) => void;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
  quiBalance: Decimal;
};

const RedemptionAction: React.FC<RedemptionActionProps> = ({
  liquity,
  price,
  exchangedQui,
  setExchangedQui,
  changePending,
  setChangePending,
  quiBalance
}) => {
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
      setExchangedQui(Decimal.from(0));
      setChangePending(false);
    }
  }, [myTransactionState.type, setChangePending, setExchangedQui, tentativelyConfirmed]);

  if (exchangedQui.isZero) {
    return null;
  }

  const send = liquity.redeemCollateral.bind(liquity, exchangedQui, price);

  return myTransactionState.type === "waitingForApproval" ? (
    <Flex sx={{ mt: 4, justifyContent: "center" }}>
      <Button disabled sx={{ mx: 2 }}>
        <Spinner sx={{ mr: 2, color: "white" }} size="20px" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex sx={{ mt: 4, justifyContent: "center" }}>
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

type RedemptionManagerProps = {
  liquity: Liquity;
  price: Decimal;
  quiBalance: Decimal;
};

export const RedemptionManager: React.FC<RedemptionManagerProps> = ({
  liquity,
  price,
  quiBalance
}) => {
  const zero = Decimal.from(0);
  const [exchangedQui, setExchangedQui] = useState(zero);
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
              onClick={() => setExchangedQui(zero)}
            >
              <Icon name="history" size="lg" />
            </Button>
          )}
        </Heading>

        {changePending && <LoadingOverlay />}

        <Box>
          <EditableRow
            label="Exchange"
            //hideLabel
            amount={exchangedQui.prettify()}
            unit="LQTY"
            {...{ editingState }}
            editedAmount={exchangedQui.toString(2)}
            setEditedAmount={editedQui => setExchangedQui(Decimal.from(editedQui))}
          ></EditableRow>

          <EditableRow
            label="Redeem"
            //hideLabel
            amount={exchangedQui.div(price).prettify(4)}
            unit="ETH"
            {...{ editingState }}
            editedAmount={exchangedQui.div(price).toString(4)}
            setEditedAmount={editedEth => setExchangedQui(Decimal.from(editedEth).mul(price))}
          ></EditableRow>
        </Box>
      </Card>

      <RedemptionAction
        {...{
          liquity,
          price,
          exchangedQui,
          setExchangedQui,
          changePending,
          setChangePending,
          quiBalance
        }}
      />
    </>
  );
};
