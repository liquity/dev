import { Decimal } from "@liquity/lib-base";
import React, { useState } from "react";
import { Flex, Button, Spinner, Text } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { EditableRow } from "../../../Trove/Editor";
import { useBondAddresses } from "../../context/BondAddressesContext";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex } from "../../context/transitions";

export const StakePane: React.FC = () => {
  const { dispatchEvent, statuses, lpTokenBalance, isBLusdLpApprovedWithGauge } = useBondView();
  const { BLUSD_AMM_STAKING_ADDRESS } = useBondAddresses();

  const editingState = useState<string>();
  const [stakeAmount, setStakeAmount] = useState<Decimal>(Decimal.ZERO);

  const isApprovePending = statuses.APPROVE_SPENDER === "PENDING";
  const coalescedLpTokenBalance = lpTokenBalance ?? Decimal.ZERO;
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBalanceInsufficient = stakeAmount.gt(coalescedLpTokenBalance);

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED", {
      tokensNeedingApproval: [BLusdAmmTokenIndex.BLUSD_LUSD_LP],
      spender: BLUSD_AMM_STAKING_ADDRESS ?? undefined
    });
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "stakeLiquidity",
      stakeAmount
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  return (
    <>
      <EditableRow
        label="Wallet LP Tokens"
        inputId="stake-lp"
        amount={stakeAmount.prettify(2)}
        editingState={editingState}
        editedAmount={stakeAmount.toString()}
        setEditedAmount={amount => setStakeAmount(Decimal.from(amount))}
        maxAmount={coalescedLpTokenBalance.toString()}
        maxedOut={stakeAmount.eq(coalescedLpTokenBalance)}
      />

      <Text sx={{ fontWeight: 300, fontSize: "16px" }}>
        Your LP tokens will be staked in the bLUSD Curve gauge to earn protocol fees and Curve
        rewards.
      </Text>

      {isBalanceInsufficient && (
        <ErrorDescription>
          LP Token amount exceeds your balance by{" "}
          <Amount>{stakeAmount.sub(coalescedLpTokenBalance).prettify(2)}</Amount>
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button variant="cancel" onClick={handleBackPressed} disabled={isManageLiquidityPending}>
          Back
        </Button>

        {!isBLusdLpApprovedWithGauge && (
          <Button
            variant="primary"
            onClick={handleApprovePressed}
            disabled={stakeAmount.isZero || isApprovePending}
          >
            {isApprovePending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Approve</>}
          </Button>
        )}

        {isBLusdLpApprovedWithGauge && (
          <Button
            variant="primary"
            onClick={handleConfirmPressed}
            disabled={stakeAmount.isZero || isBalanceInsufficient || isManageLiquidityPending}
          >
            {isManageLiquidityPending ? (
              <Spinner size="28px" sx={{ color: "white" }} />
            ) : (
              <>Confirm</>
            )}
          </Button>
        )}
      </Flex>
    </>
  );
};
