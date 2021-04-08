import React, { useCallback, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, Difference, LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { LP, GT } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useFarmView } from "../../context/FarmViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { Confirm } from "../Confirm";
import { Description } from "../Description";
import { Approve } from "../Approve";
import { Validation } from "../Validation";

const selector = ({
  liquidityMiningStake,
  liquidityMiningLQTYReward,
  uniTokenBalance,
  totalStakedUniTokens
}: LiquityStoreState) => ({
  liquidityMiningStake,
  liquidityMiningLQTYReward,
  uniTokenBalance,
  totalStakedUniTokens
});

const transactionId = /farm-/;

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const {
    liquidityMiningStake,
    liquidityMiningLQTYReward,
    uniTokenBalance,
    totalStakedUniTokens
  } = useLiquitySelector(selector);
  const [amount, setAmount] = useState<Decimal>(liquidityMiningStake);
  const editingState = useState<string>();

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";
  const isDirty = !amount.eq(liquidityMiningStake);
  const maximumAmount = liquidityMiningStake.add(uniTokenBalance);
  const hasSetMaximumAmount = amount.eq(maximumAmount);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const nextTotalStakedUniTokens = isDirty
    ? totalStakedUniTokens.sub(liquidityMiningStake).add(amount)
    : totalStakedUniTokens;

  const originalPoolShare = liquidityMiningStake.mulDiv(100, totalStakedUniTokens);
  const poolShare = amount.mulDiv(100, nextTotalStakedUniTokens);

  const poolShareChange =
    liquidityMiningStake.nonZero && Difference.between(poolShare, originalPoolShare).nonZero;

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        {isDirty && !isTransactionPending && (
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
          inputId="farm-stake-amount"
          amount={isDirty ? amount.prettify(4) : liquidityMiningStake.prettify(4)}
          unit={LP}
          editingState={editingState}
          editedAmount={amount.toString(4)}
          setEditedAmount={amount => setAmount(Decimal.from(amount))}
          maxAmount={maximumAmount.toString()}
          maxedOut={hasSetMaximumAmount}
        ></EditableRow>

        {poolShare.infinite ? (
          <StaticRow label="Pool share" inputId="farm-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="farm-share"
            amount={poolShare.prettify(4)}
            unit="%"
            pendingAmount={poolShareChange?.prettify(4).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
          />
        )}

        <StaticRow
          label="Reward"
          inputId="farm-reward-amount"
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
          <Approve amount={amount} />
          <Confirm amount={amount} />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
