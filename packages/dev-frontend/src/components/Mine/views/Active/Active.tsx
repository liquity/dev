import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Trove/Editor";
import { useMineView } from "../../context/MineViewContext";
import { RemainingLQTY } from "../RemainingLQTY";
import { ActionDescription } from "../../../ActionDescription";
import { ClaimReward } from "./ClaimReward";
import { UnstakeAndClaim } from "../UnstakeAndClaim";

const selector = ({ liquidityMiningStake, liquidityMiningLQTYReward }: LiquityStoreState) => ({
  liquidityMiningStake,
  liquidityMiningLQTYReward
});
const transactionId = /mine-/i;

export const Active: React.FC = () => {
  const { dispatchEvent } = useMineView();
  const { liquidityMiningStake, liquidityMiningLQTYReward } = useLiquitySelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionId.test(transactionState.id);

  return (
    <Card>
      <Heading>
        Liquidity mine
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <Box>
          <DisabledEditableRow
            label="Deposit"
            inputId="mine-deposit"
            amount={liquidityMiningStake.prettify(4)}
            unit={LP}
          />
          <StaticRow
            label="Reward"
            inputId="mine-reward"
            amount={liquidityMiningLQTYReward.prettify(4)}
            color={liquidityMiningLQTYReward.nonZero && "success"}
            unit={GT}
          />
          {isWaitingForTransaction && (
            <>
              <LoadingOverlay />

              <ActionDescription>
                <Text>Waiting for approval...</Text>
              </ActionDescription>
            </>
          )}
        </Box>

        <Flex variant="layout.actions">
          <Button variant="outline" onClick={handleAdjustPressed}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          <ClaimReward />
        </Flex>
        <Flex>
          <UnstakeAndClaim />
        </Flex>
      </Box>
    </Card>
  );
};
