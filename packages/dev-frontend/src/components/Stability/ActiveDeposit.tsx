import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { COIN, GT } from "../../strings";
import { Icon } from "../Icon";
import { LoadingOverlay } from "../LoadingOverlay";
import { useMyTransactionState } from "../Transaction";
import { StaticRow } from "../Trove/Editor";
import { ClaimAndMove } from "./actions/ClaimAndMove";
import { ClaimRewards } from "./actions/ClaimRewards";
import { useStabilityView } from "./context/StabilityViewContext";

const selector = ({ stabilityDeposit, trove }: LiquityStoreState) => ({ stabilityDeposit, trove });

export const ActiveDeposit: React.FC = props => {
  const { dispatchEvent } = useStabilityView();
  const { stabilityDeposit, trove } = useLiquitySelector(selector);

  const handleAdjustDeposit = useCallback(() => {
    dispatchEvent("ADJUST_DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const hasReward = !stabilityDeposit.lqtyReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;
  const hasRewardAndGain = hasReward && hasGain;

  const hasTrove = !trove.isEmpty;

  const transactionId = "stability-deposit";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

  return (
    <Card>
      <Heading>Stability Pool</Heading>
      <Box>
        <Box>
          <StaticRow
            label="Deposit"
            inputId="deposit-lusd"
            amount={stabilityDeposit.currentLUSD.prettify(4)}
            unit={COIN}
          />
          <StaticRow
            label="Gain"
            inputId="deposit-gain"
            amount={stabilityDeposit.collateralGain.prettify(4)}
            color={stabilityDeposit.collateralGain.nonZero && "success"}
            unit={"ETH"}
          />
          <StaticRow
            label="Reward"
            inputId="deposit-reward"
            amount={stabilityDeposit.lqtyReward.prettify(4)}
            color={stabilityDeposit.lqtyReward.nonZero && "success"}
            unit={GT}
          />
          {isWaitingForTransaction && (
            <>
              <LoadingOverlay />

              <Flex variant="layout.infoMessage">
                <Icon
                  style={{ marginRight: "2px", display: "flex", alignItems: "center" }}
                  name="info-circle"
                />
                <Text>Waiting for approval...</Text>
              </Flex>
            </>
          )}
        </Box>

        <Flex variant="layout.actions">
          {hasRewardAndGain && <ClaimRewards>Claim rewards</ClaimRewards>}
          {hasGain && !hasReward && <ClaimRewards>Claim ETH</ClaimRewards>}
          <Button variant="primary" onClick={handleAdjustDeposit}>
            Adjust
          </Button>
        </Flex>
        {hasTrove && hasRewardAndGain && (
          <Flex>
            <ClaimAndMove>Claim LQTY and move ETH to Trove</ClaimAndMove>
          </Flex>
        )}
        {hasTrove && hasGain && !hasReward && (
          <Flex>
            <ClaimAndMove>Move ETH to Trove</ClaimAndMove>
          </Flex>
        )}
      </Box>
    </Card>
  );
};
