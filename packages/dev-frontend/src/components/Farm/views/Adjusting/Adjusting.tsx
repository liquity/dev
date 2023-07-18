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
  xbrlWethLiquidityMiningStake,
  xbrlWethLiquidityMiningSTBLReward,
  xbrlWethUniTokenBalance,
  totalStakedXbrlWethUniTokens
}: LiquityStoreState) => ({
  xbrlWethLiquidityMiningStake,
  xbrlWethLiquidityMiningSTBLReward,
  xbrlWethUniTokenBalance,
  totalStakedXbrlWethUniTokens
});

const transactionId = /farm-/;

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useFarmView();
  const {
    xbrlWethLiquidityMiningStake,
    xbrlWethLiquidityMiningSTBLReward,
    xbrlWethUniTokenBalance,
    totalStakedXbrlWethUniTokens
  } = useLiquitySelector(selector);
  const [amount, setAmount] = useState<Decimal>(xbrlWethLiquidityMiningStake);
  const editingState = useState<string>();

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";
  const isDirty = !amount.eq(xbrlWethLiquidityMiningStake);
  const maximumAmount = xbrlWethLiquidityMiningStake.add(xbrlWethUniTokenBalance);
  const hasSetMaximumAmount = amount.eq(maximumAmount);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const nextTotalStakedUniTokens = isDirty
    ? totalStakedXbrlWethUniTokens.sub(xbrlWethLiquidityMiningStake).add(amount)
    : totalStakedXbrlWethUniTokens;

  const originalPoolShare = xbrlWethLiquidityMiningStake.mulDiv(100, totalStakedXbrlWethUniTokens);
  const poolShare = amount.mulDiv(100, nextTotalStakedUniTokens);

  const poolShareChange =
  xbrlWethLiquidityMiningStake.nonZero && Difference.between(poolShare, originalPoolShare).nonZero;

  return (
    <Card>
      <Heading>
        Uniswap Liquidity Farm
        {isDirty && !isTransactionPending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(xbrlWethLiquidityMiningStake)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="farm-stake-amount"
          amount={isDirty ? amount.prettify(4) : xbrlWethLiquidityMiningStake.prettify(4)}
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
          amount={xbrlWethLiquidityMiningSTBLReward.prettify(4)}
          color={xbrlWethLiquidityMiningSTBLReward.nonZero && "success"}
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
