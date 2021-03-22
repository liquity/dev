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
import { Confirm } from "../Confirm";
import { Description } from "../Description";
import { Approve } from "../Approve";
import { Validation } from "../Validation";

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

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="mine-stake-amount"
          amount={isDirty ? amount.prettify(4) : liquidityMiningStake.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.toString(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
        ></EditableRow>

        <StaticRow
          label="Reward"
          inputId="mine-reward-amount"
          amount={liquidityMiningLQTYReward.prettify(4)}
          color={liquidityMiningLQTYReward.nonZero && "success"}
          unit={GT}
        />

        {isDirty && <Validation amount={amount} />}
        {isDirty && <Description amount={amount} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <Approve amount={amountChanged} />
          <Confirm amount={amount} />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
