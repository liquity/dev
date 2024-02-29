import React from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { ActionDescription, Amount } from "../../../../../ActionDescription";
import { useBondView } from "../../../../context/BondViewContext";

export const Claim: React.FC = () => {
  const { dispatchEvent, selectedBond: bond, statuses } = useBondView();

  const isProcessingTransaction = statuses.CLAIM === "PENDING";

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED");
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  if (bond === undefined) return null;

  return (
    <>
      <ActionDescription>
        You will receive <Amount>{bond.accrued.prettify(2)} bLUSD</Amount> and forgo your bonded{" "}
        <Amount>{bond.deposit.prettify(2)} LUSD</Amount>
      </ActionDescription>

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isProcessingTransaction}>
          Back
        </Button>
        <Button variant="primary" onClick={handleConfirmPressed} disabled={isProcessingTransaction}>
          {!isProcessingTransaction && <>Confirm</>}
          {isProcessingTransaction && <Spinner size={28} sx={{ color: "white" }} />}
        </Button>
      </Flex>
    </>
  );
};
