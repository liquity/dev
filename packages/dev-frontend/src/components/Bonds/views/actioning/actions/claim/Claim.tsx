import React, { useState } from "react";
import { Flex, Button, Text, Spinner } from "theme-ui";
import { ActionDescription } from "../../../../../ActionDescription";
import { useBondView } from "../../../../context/BondViewContext";

export const Claim: React.FC = () => {
  const { dispatchEvent, selectedBond: bond } = useBondView();
  const [isProcessingTransaction, setIsProcessingTransaction] = useState(false);

  const handleConfirmPressed = () => {
    setIsProcessingTransaction(true);
    dispatchEvent("CONFIRM_PRESSED");
  };
  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  if (bond === undefined) return null;

  return (
    <>
      <ActionDescription>
        You will receive <Text sx={{ fontWeight: "bold" }}>{bond.accrued.prettify(2)} bLUSD</Text>{" "}
        and forgo your bonded{" "}
        <Text sx={{ fontWeight: "bold" }}>{bond.deposit.prettify(2)} LUSD</Text>
        {isProcessingTransaction && <Flex mt={1}>Transaction processing...</Flex>}
      </ActionDescription>

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isProcessingTransaction}>
          Back
        </Button>
        <Button variant="primary" onClick={handleConfirmPressed} disabled={isProcessingTransaction}>
          {!isProcessingTransaction && <>Confirm</>}
          {isProcessingTransaction && <Spinner size="28px" sx={{ color: "white" }} />}
        </Button>
      </Flex>
    </>
  );
};
