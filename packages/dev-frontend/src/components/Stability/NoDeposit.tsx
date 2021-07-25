import React, { useCallback, useState, useEffect } from "react";
import { Card, Heading, Box, Flex, Button, Container, Close, Text } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";
import { useLiquitySelector } from "@liquity/lib-react";
import { useTransactionFunction } from "../Transaction";
import { useLiquity } from "./../../hooks/LiquityContext";


const selector = ( {bammAllowance}: any) => ({
  bammAllowance
});

export const UnlockButton: React.FC = props => {
  const { liquity } = useLiquity();
  const [sendTransaction, transactionState] = useTransactionFunction(
    "bamm-unlock",
    liquity.send.bammUnlock.bind(liquity.send)
  );

  return (
    <Text 
      onClick={sendTransaction} 
      sx={{ 
        fontWeight: "bold", 
        whiteSpace: "nowrap", 
        cursor: "pointer", 
        textDecoration: "underline" }}>
          {props.children}
    </Text>
  )
}

export const NoDeposit: React.FC = props => {
  const { liquity } = useLiquity();
  const { bammAllowance } = useLiquitySelector(selector);
  const { dispatchEvent } = useStabilityView();

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  return (
    <Card>
      <Heading>
        Stability Pool
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no LUSD in the Stability Pool.">
          You can earn ETH and LQTY rewards by depositing LUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>
            <Button onClick={handleOpenTrove}>Deposit</Button>
        </Flex>
      </Box>
    </Card>
  );
};
