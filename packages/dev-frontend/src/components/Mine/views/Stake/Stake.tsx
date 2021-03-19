import React, { useCallback, useEffect, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { LP } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMineView } from "../../context/MineViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { ConfirmButton } from "./ConfirmButton";
import { Description } from "./Description";
import { useLiquitySelector } from "@liquity/lib-react";

const transactionId = "mine-stake";
const selector = ({ uniTokenAllowance }: LiquityStoreState) => ({ uniTokenAllowance });

export const Stake: React.FC = () => {
  const { dispatchEvent } = useMineView();
  const [amount, setAmount] = useState<Decimal>(Decimal.from(0));
  const editingState = useState<string>();
  const isDirty = !amount.isZero;

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

  const { uniTokenAllowance } = useLiquitySelector(selector);
  const hasApprovedUniLpSpend = !uniTokenAllowance.isZero;

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("STAKE_CONFIRMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Card>
      <Heading>
        Liquidity mine
        {isDirty && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(Decimal.from(0))}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {isTransactionPending && <LoadingOverlay />}

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="amount-lp"
          amount={amount.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.prettify(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
        ></EditableRow>

        {isDirty && <Description amount={amount} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <Button disabled={hasApprovedUniLpSpend} sx={{ width: "60%" }}>
            Approve UNI LP
          </Button>
          <ConfirmButton isDisabled={!hasApprovedUniLpSpend} amount={amount} />
        </Flex>
      </Box>
    </Card>
  );
};
