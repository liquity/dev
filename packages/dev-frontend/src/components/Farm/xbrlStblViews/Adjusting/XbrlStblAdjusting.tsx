import React, { useCallback, useState } from "react";
import { Heading, Box, Flex, Card, Button } from "theme-ui";
import { Decimal, Difference, StabilioStoreState } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";

import { LP, GT } from "../../../../strings";
import { Icon } from "../../../Icon";
import { EditableRow, StaticRow } from "../../../Trove/Editor";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useXbrlStblFarmView } from "../../context/XbrlStblFarmViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { XbrlStblConfirm } from "../XbrlStblConfirm";
import { XbrlStblDescription } from "../XbrlStblDescription";
import { XbrlStblApprove } from "../XbrlStblApprove";
import { XbrlStblValidation } from "../XbrlStblValidation";

const selector = ({
  xbrlStblLiquidityMiningStake,
  xbrlStblLiquidityMiningSTBLReward,
  xbrlStblUniTokenBalance,
  totalStakedXbrlStblUniTokens
}: StabilioStoreState) => ({
  xbrlStblLiquidityMiningStake,
  xbrlStblLiquidityMiningSTBLReward,
  xbrlStblUniTokenBalance,
  totalStakedXbrlStblUniTokens
});

const transactionId = /farm-/;

export const XbrlStblAdjusting: React.FC = () => {
  const { dispatchEvent } = useXbrlStblFarmView();
  const {
    xbrlStblLiquidityMiningStake,
    xbrlStblLiquidityMiningSTBLReward,
    xbrlStblUniTokenBalance,
    totalStakedXbrlStblUniTokens
  } = useStabilioSelector(selector);
  const [amount, setAmount] = useState<Decimal>(xbrlStblLiquidityMiningStake);
  const editingState = useState<string>();

  const transactionState = useMyTransactionState(transactionId);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";
  const isDirty = !amount.eq(xbrlStblLiquidityMiningStake);
  const maximumAmount = xbrlStblLiquidityMiningStake.add(xbrlStblUniTokenBalance);
  const hasSetMaximumAmount = amount.eq(maximumAmount);

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_PRESSED");
  }, [dispatchEvent]);

  const nextTotalStakedUniTokens = isDirty
    ? totalStakedXbrlStblUniTokens.sub(xbrlStblLiquidityMiningStake).add(amount)
    : totalStakedXbrlStblUniTokens;

  const originalPoolShare = xbrlStblLiquidityMiningStake.mulDiv(100, totalStakedXbrlStblUniTokens);
  const poolShare = amount.mulDiv(100, nextTotalStakedUniTokens);

  const poolShareChange =
  xbrlStblLiquidityMiningStake.nonZero && Difference.between(poolShare, originalPoolShare).nonZero;

  return (
    <Card>
      <Flex sx={{ justifyContent: "space-between", width: "100%", px: [2, 3], pt: 3, pb: 2 }}>
        <Heading sx={{ fontSize: 16  }}>
          STBL/xBRL Uniswap LP
        </Heading>
        {isDirty && !isTransactionPending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setAmount(xbrlStblLiquidityMiningStake)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Flex>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Stake"
          inputId="farm-stake-amount"
          amount={isDirty ? amount.prettify(4) : xbrlStblLiquidityMiningStake.prettify(4)}
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
          amount={xbrlStblLiquidityMiningSTBLReward.prettify(4)}
          color={xbrlStblLiquidityMiningSTBLReward.nonZero && "success"}
          unit={GT}
        />

        {isDirty && <XbrlStblValidation amount={amount} />}
        {isDirty && <XbrlStblDescription amount={amount} />}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>
          <XbrlStblApprove amount={amount} />
          <XbrlStblConfirm amount={amount} />
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
