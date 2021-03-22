import React, { useCallback, useEffect, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { LP, GT } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMineView } from "../../context/MineViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { ConfirmButton } from "./ConfirmButton";
import { Description } from "./Description";

const selector = ({ liquidityMiningStake, liquidityMiningLQTYReward }: LiquityStoreState) => ({
  liquidityMiningStake,
  liquidityMiningLQTYReward
});

const transactionId = "mine-adjust";

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useMineView();
  const { liquidityMiningStake, liquidityMiningLQTYReward } = useLiquitySelector(selector);
  const [amount, setAmount] = useState<Decimal>(liquidityMiningStake);
  const editingState = useState<string>();

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

  const isWithdrawing = amount.lt(liquidityMiningStake);
  const amountChanged = isWithdrawing
    ? liquidityMiningStake.sub(amount)
    : Decimal.from(amount).sub(liquidityMiningStake);

  const isDirty = !amount.eq(liquidityMiningStake);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("ADJUST_CONFIRMED");
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
            onClick={() => setAmount(liquidityMiningStake)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {isTransactionPending && <LoadingOverlay />}

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Deposit"
          inputId="mine-stake-amount"
          amount={liquidityMiningStake.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.prettify(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
        ></EditableRow>

        <StaticRow
          label="Reward"
          inputId="mine-reward-amount"
          amount={liquidityMiningLQTYReward.prettify(4)}
          color={liquidityMiningLQTYReward.nonZero && "success"}
          unit={GT}
        />

        {isDirty && <Description amountChanged={amountChanged} isWithdrawing={isWithdrawing} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <ConfirmButton amountChanged={amountChanged} isWithdrawing={isWithdrawing} />
        </Flex>
      </Box>
    </Card>
  );
};
