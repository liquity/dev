import React from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { useBondView } from "../../context/BondViewContext";
import { PendingRewards } from "./PendingRewards";

export const RewardsPane: React.FC = () => {
  const { dispatchEvent, statuses, lpRewards } = useBondView();

  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const hasRewards = lpRewards?.find(reward => reward.amount.gt(0)) !== undefined;

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "claimLpRewards"
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  return (
    <>
      <PendingRewards />

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isManageLiquidityPending}>
          Back
        </Button>

        <Button variant="primary" onClick={handleConfirmPressed} disabled={!hasRewards}>
          {isManageLiquidityPending ? (
            <Spinner size="28px" sx={{ color: "white" }} />
          ) : (
            <>Claim all rewards</>
          )}
        </Button>
      </Flex>
    </>
  );
};
