import React, { useCallback, useEffect } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";

import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";
import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { useMyTransactionState } from "../Transaction";
import { DisabledEditableRow, StaticRow } from "../Trove/Editor";
import { ClaimAndMove } from "./actions/ClaimAndMove";
import { ClaimRewards } from "./actions/ClaimRewards";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";

const selector = ({ stabilityDeposit, trove }: LiquityStoreState) => ({ stabilityDeposit, trove });

export const ActiveDeposit: React.FC = () => {
  const { dispatchEvent } = useStabilityView();
  const { stabilityDeposit, trove } = useLiquitySelector(selector);

  const handleAdjustDeposit = useCallback(() => {
    dispatchEvent("ADJUST_DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const hasReward = !stabilityDeposit.lqtyReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;
  const hasTrove = !trove.isEmpty;

  const transactionId = "stability-deposit";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("REWARDS_CLAIMED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Card>
      <Heading>
        Stability Pool
        {!isWaitingForTransaction && (
          <Flex sx={{ justifyContent: "flex-end" }}>
            <RemainingLQTY />
          </Flex>
        )}
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Deposit"
            inputId="deposit-lusd"
            amount={stabilityDeposit.currentLUSD.prettify()}
            unit={COIN}
          />

          <StaticRow
            label="Liquidation gain"
            inputId="deposit-gain"
            amount={stabilityDeposit.collateralGain.prettify(4)}
            color={stabilityDeposit.collateralGain.nonZero && "success"}
            unit="ETH"
          />

          <Flex sx={{ alignItems: "center" }}>
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={stabilityDeposit.lqtyReward.prettify()}
              color={stabilityDeposit.lqtyReward.nonZero && "success"}
              unit={GT}
            />
            <Flex sx={{ justifyContent: "flex-end", flex: 1 }}>
              <Yield />
            </Flex>
          </Flex>
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleAdjustDeposit}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>

          <ClaimRewards disabled={!hasGain && !hasReward}>Claim ETH and LQTY</ClaimRewards>
        </Flex>

        {hasTrove && (
          <ClaimAndMove disabled={!hasGain && !hasReward}>
            Claim LQTY and move ETH to Trove
          </ClaimAndMove>
        )}
      </Box>

      {isWaitingForTransaction && <LoadingOverlay />}
    </Card>
  );
};
