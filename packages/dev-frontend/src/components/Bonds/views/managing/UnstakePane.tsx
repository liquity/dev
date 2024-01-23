import { Decimal } from "@liquity/lib-base";
import React, { useState } from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { EditableRow, StaticAmounts, StaticRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { PendingRewards } from "./PendingRewards";
import { PoolBalance } from "./PoolBalance";

export const UnstakePane: React.FC = () => {
  const { dispatchEvent, statuses, stakedLpTokenBalance, protocolInfo } = useBondView();

  const editingState = useState<string>();
  const [unstakeAmount, setUnstakeAmount] = useState<Decimal>(Decimal.ZERO);

  const coalescedStakedLpTokenBalance = stakedLpTokenBalance ?? Decimal.ZERO;
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBalanceInsufficient = unstakeAmount.gt(coalescedStakedLpTokenBalance);

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "unstakeLiquidity",
      unstakeAmount
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  return (
    <>
      <EditableRow
        label="Staked LP Tokens"
        inputId="unstake-lp"
        amount={unstakeAmount.prettify(2)}
        editingState={editingState}
        editedAmount={unstakeAmount.toString()}
        setEditedAmount={amount => setUnstakeAmount(Decimal.from(amount))}
        maxAmount={coalescedStakedLpTokenBalance.toString()}
        maxedOut={unstakeAmount.eq(coalescedStakedLpTokenBalance)}
      />

      <PendingRewards />

      <StaticRow label="bLUSD LP APR">
        <StaticAmounts sx={{ alignItems: "center", justifyContent: "flex-start" }}>
          <PoolBalance symbol="%">
            {(protocolInfo?.bLusdLpApr ?? Decimal.INFINITY).prettify(2)}
          </PoolBalance>{" "}
        </StaticAmounts>
      </StaticRow>

      <Flex mb={3} sx={{ fontWeight: 300, fontSize: "16px" }}>
        Your staked LP tokens will be unstaked from the bLUSD Curve gauge and moved into your wallet.
        Pending rewards will also be claimed and moved into your wallet.
      </Flex>

      {isBalanceInsufficient && (
        <ErrorDescription>
          LP Token amount exceeds your balance by{" "}
          <Amount>{unstakeAmount.sub(coalescedStakedLpTokenBalance).prettify(2)}</Amount>
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isManageLiquidityPending}>
          Back
        </Button>

        <Button
          variant="primary"
          onClick={handleConfirmPressed}
          disabled={unstakeAmount.isZero || isBalanceInsufficient || isManageLiquidityPending}
        >
          {isManageLiquidityPending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Confirm</>}
        </Button>
      </Flex>
    </>
  );
};
