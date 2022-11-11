import { Decimal } from "@liquity/lib-base";
import React from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { StaticRow, StaticAmounts } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { PendingRewards } from "./PendingRewards";
import { PoolBalance } from "./PoolBalance";

export const RewardsPane: React.FC = () => {
  const { dispatchEvent, statuses, lpRewards, protocolInfo } = useBondView();

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

      <StaticRow label="bLUSD LP APR">
        <StaticAmounts sx={{ alignItems: "center", justifyContent: "flex-start" }}>
          <PoolBalance symbol="%">
            {(protocolInfo?.bLusdLpApr ?? Decimal.INFINITY).prettify(2)}
          </PoolBalance>{" "}
        </StaticAmounts>
      </StaticRow>

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
