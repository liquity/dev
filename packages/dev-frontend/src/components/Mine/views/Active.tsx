import React, { useCallback } from "react";
import { Card, Heading, Box, Flex, Text, Button } from "theme-ui";
import { LP, GT } from "../../../strings";
// import { LiquityStoreState } from "@liquity/lib-base";
// import { useLiquitySelector } from "@liquity/lib-react";
import { Icon } from "../../Icon";
import { LoadingOverlay } from "../../LoadingOverlay";
import { useMyTransactionState } from "../../Transaction";
import { StaticRow } from "../../Trove/Editor";
import { useMineView } from "../context/MineViewContext";

// const selector = ({ miningDeposit }: LiquityStoreState) => ({ miningDeposit });

export const Active: React.FC = () => {
  const { dispatchEvent } = useMineView();
  // const { miningDeposit } = useLiquitySelector(selector);

  const handleAdjustPressed = useCallback(() => {
    dispatchEvent("ADJUST_PRESSED");
  }, [dispatchEvent]);

  const transactionId = "uniswap-stake";
  const transactionState = useMyTransactionState(transactionId);
  const isWaitingForTransaction =
    (transactionState.type === "waitingForApproval" ||
      transactionState.type === "waitingForConfirmation") &&
    transactionState.id === transactionId;

  return (
    <Card>
      <Heading>Mine</Heading>
      <Box>
        <Box>
          <StaticRow
            label="Deposit"
            inputId="mine-deposit"
            amount="0"
            // amount={miningDeposit.currentLUSD.prettify(4)}
            unit={LP}
          />
          <StaticRow
            label="Reward"
            inputId="mine-reward"
            amount="0"
            // amount={miningDeposit.lqtyReward.prettify(4)}
            // color={miningDeposit.lqtyReward.nonZero && "success"}
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
          <Button variant="primary" onClick={handleAdjustPressed}>
            Adjust
          </Button>
        </Flex>
      </Box>
    </Card>
  );
};
