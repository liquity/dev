import React from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { ActionDescription, Amount } from "../../../../../ActionDescription";
import { useBondView } from "../../../../context/BondViewContext";

export const Cancel: React.FC = () => {
  const { dispatchEvent, selectedBond: bond, statuses } = useBondView();

  const isProcessingTransaction = statuses.CANCEL === "PENDING";

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
        You will receive your bonded <Amount>{bond.deposit.prettify(2)} LUSD</Amount> back and forgo{" "}
        <Amount>{bond.accrued.shorten()} bLUSD</Amount>
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
