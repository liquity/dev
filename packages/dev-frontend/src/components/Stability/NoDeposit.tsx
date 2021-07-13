import React, { useCallback, useState, useEffect } from "react";
import { Card, Heading, Box, Flex, Button } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useTransactionFunction } from "../Transaction";
import { useLiquity } from "./../../hooks/LiquityContext";

//create your forceUpdate hook
function useForceUpdate(){
  const [value, setValue] = useState(0); // integer state
  return () => setValue(value => value + 1); // update the state to force render
}

const selector = ({ stabilityDeposit }: LiquityStoreState) => ({
  stabilityDeposit
});

export const NoDeposit: React.FC = props => {
  const { liquity } = useLiquity();
  const { stabilityDeposit } = useLiquitySelector(selector);
  const { dispatchEvent } = useStabilityView();
  const [allowanceSucceed, setAllowanceSucceed] = useState(false);

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const [sendTransaction, transactionState] = useTransactionFunction(
    "bamm-unlock",
    liquity.send.bammUnlock.bind(liquity.send)
  );

  useEffect(() => {
    if (transactionState.type === "confirmed") {
      setAllowanceSucceed(true);
    }
  }, [transactionState.type]);

  const hasAllowance = allowanceSucceed || stabilityDeposit.bammAllowance
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
          {hasAllowance  && 
            <Button onClick={handleOpenTrove}>Deposit</Button>
          }
          {!hasAllowance  && 
            <Button onClick={sendTransaction}>Unlock BAMM</Button>
          }
        </Flex>
      </Box>
    </Card>
  );
};
