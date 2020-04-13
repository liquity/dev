import React, { useState, useEffect } from "react";
import { Button, Box, Flex, Loader, Card, Heading, Link, Icon } from "rimble-ui";

import { Liquity } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { Transaction, useMyTransactionState } from "./Transaction";
import { LoadingOverlay } from "./LoadingOverlay";
import { EditableRow } from "./Editor";

type RedemptionActionProps = {
  liquity: Liquity;
  price: Decimal;
  exchangedQui: Decimal;
  setExchangedQui: (exchangedQui: Decimal) => void;
  changePending: boolean;
  setChangePending: (isPending: boolean) => void;
};

const RedemptionAction: React.FC<RedemptionActionProps> = ({
  liquity,
  price,
  exchangedQui,
  setExchangedQui,
  changePending,
  setChangePending
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
    <Flex mt={4} justifyContent="center">
      <Button disabled mx={2}>
        <Loader mr={2} color="white" />
        Waiting for your approval
      </Button>
    </Flex>
  ) : changePending ? null : (
    <Flex mt={4} justifyContent="center">
      <Transaction id={myTransactionId} {...{ send }}>
        <Button mx={2}>Exchange {exchangedQui.prettify()} QUI</Button>
      </Transaction>
    </Flex>
  );
};

type RedemptionManagerProps = {
  liquity: Liquity;
  price: Decimal;
};

export const RedemptionManager: React.FC<RedemptionManagerProps> = ({ liquity, price }) => {
  const zero = Decimal.from(0);
  const [exchangedQui, setExchangedQui] = useState(zero);
  const [changePending, setChangePending] = useState(false);

  const editingState = useState<string>();

  const edited = exchangedQui.nonZero !== undefined;

  return (
    <>
      <Box mt={4}>
        <Card p={0}>
          <Heading
            as="h3"
            bg="lightgrey"
            pl={3}
            py={2}
            pr={2}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            Redeem Collateral with QUI
            <Box width="40px" height="40px">
              {edited && !changePending && (
                <Link
                  color="text"
                  hoverColor="danger"
                  activeColor="danger"
                  display="flex"
                  alignItems="center"
                  onClick={() => setExchangedQui(zero)}
                >
                  <Icon name="Replay" size="40px" />
                </Link>
              )}
            </Box>
          </Heading>

          {changePending && (
            <LoadingOverlay>
              <Loader size="24px" color="text" />
            </LoadingOverlay>
          )}

          <Box p={2}>
            <EditableRow
              label="Exchange"
              //hideLabel
              amount={exchangedQui.prettify()}
              unit="QUI"
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
      </Box>

      <RedemptionAction
        {...{ liquity, price, exchangedQui, setExchangedQui, changePending, setChangePending }}
      />
    </>
  );
};
