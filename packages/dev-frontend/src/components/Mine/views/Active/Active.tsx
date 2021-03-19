import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { LP, GT } from "../../../../strings";
// import { LiquityStoreState } from "@liquity/lib-base";
// import { useLiquitySelector } from "@liquity/lib-react";
import { Icon } from "../../../Icon";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useMyTransactionState } from "../../../Transaction";
import { DisabledEditableRow, StaticRow } from "../../../Trove/Editor";
import { useMineView } from "../../context/MineViewContext";
import { RemainingLQTY } from "../RemainingLQTY";

// const selector = ({ lpStaked }: LiquityStoreState) => ({ lpStaked });

export const Active: React.FC = () => {
  const { dispatchEvent } = useMineView();
  // const { lpStaked } = useLiquitySelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionId = "mine-stake-or-claim";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

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
            amount="10"
            // amount={lpStaked.currentLp.prettify(4)}
            unit={LP}
          />
          <StaticRow
            label="Reward"
            inputId="mine-reward"
            amount="50"
            // amount={lpStaked.lqtyReward.prettify(4)}
            color={"success"}
            // color={lpStaked.lqtyReward.nonZero && "success"}
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
          <Button variant="outline" onClick={handleAdjustPressed}>
            <Icon name="pen" size="sm" />
            &nbsp;Adjust
          </Button>
          <Button variant="primary">Claim reward</Button>
        </Flex>
        <Flex>
          <Button variant="outline" sx={{ mt: 3, ml: 2, width: "100%" }}>
            Unstake and claim reward
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
