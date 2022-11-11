import { Decimal } from "@liquity/lib-base";
import React, { useState } from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { EditableRow, StaticAmounts, StaticRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { ApprovePressedPayload, BLusdAmmTokenIndex } from "../../context/transitions";
import { PoolBalance } from "./PoolBalance";

export const StakePane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    lpTokenBalance,
    isBLusdLpApprovedWithGauge,
    addresses,
    protocolInfo
  } = useBondView();

  const editingState = useState<string>();
  const [stakeAmount, setStakeAmount] = useState<Decimal>(Decimal.ZERO);

  const isApprovePending = statuses.APPROVE_SPENDER === "PENDING";
  const coalescedLpTokenBalance = lpTokenBalance ?? Decimal.ZERO;
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBalanceInsufficient = stakeAmount.gt(coalescedLpTokenBalance);

  const handleApprovePressed = () => {
    const tokensNeedingApproval = new Map();
    if (!isBLusdLpApprovedWithGauge) {
      tokensNeedingApproval.set(
        BLusdAmmTokenIndex.BLUSD_LUSD_LP,
        addresses.BLUSD_AMM_STAKING_ADDRESS
      );
    }
    dispatchEvent("APPROVE_PRESSED", {
      tokensNeedingApproval
    } as ApprovePressedPayload);
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

      <Flex mt={3}>
        <StaticRow label="bLUSD LP APR">
          <StaticAmounts sx={{ alignItems: "center", justifyContent: "flex-start" }}>
            <PoolBalance symbol="%">
              {(protocolInfo?.bLusdLpApr ?? Decimal.INFINITY).prettify(2)}
            </PoolBalance>{" "}
          </StaticAmounts>
        </StaticRow>
      </Flex>

      <Flex my={3} sx={{ fontWeight: 300, fontSize: "16px" }}>
        Your LP tokens will be staked in the bLUSD Curve gauge to earn protocol fees and Curve
        rewards.
      </Flex>

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
