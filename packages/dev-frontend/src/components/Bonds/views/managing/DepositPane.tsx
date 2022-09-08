import { Decimal } from "@liquity/lib-base";
import React, { useEffect, useState } from "react";
import { Flex, Button, Spinner } from "theme-ui";
import { Amount } from "../../../ActionDescription";
import { ErrorDescription } from "../../../ErrorDescription";
import { Icon } from "../../../Icon";
import { DisabledEditableRow, EditableRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";
import { BLusdAmmTokenIndex } from "../../context/transitions";
import { PoolDetails } from "./PoolDetails";

export const DepositPane: React.FC = () => {
  const {
    dispatchEvent,
    statuses,
    lusdBalance,
    bLusdBalance,
    isBLusdApprovedWithBlusdAmm,
    isLusdApprovedWithBlusdAmm,
    getExpectedLpTokens
  } = useBondView();

  const editingState = useState<string>();
  const [bLusdAmount, setBLusdAmount] = useState<Decimal>(Decimal.ZERO);
  const [lusdAmount, setLusdAmount] = useState<Decimal>(Decimal.ZERO);
  const [lpTokens, setLpTokens] = useState<Decimal>(Decimal.ZERO);

  const coalescedBLusdBalance = bLusdBalance ?? Decimal.ZERO;
  const coalescedLusdBalance = lusdBalance ?? Decimal.ZERO;

  const isApprovePending = statuses.APPROVE_AMM === "PENDING";
  const isManageLiquidityPending = statuses.MANAGE_LIQUIDITY === "PENDING";
  const isBLusdBalanceInsufficient = bLusdAmount.gt(coalescedBLusdBalance);
  const isLusdBalanceInsufficient = lusdAmount.gt(coalescedLusdBalance);
  const isAnyBalanceInsufficient = isBLusdBalanceInsufficient || isLusdBalanceInsufficient;

  const tokensNeedingApproval = [
    bLusdAmount.isZero || isBLusdApprovedWithBlusdAmm ? [] : [BLusdAmmTokenIndex.BLUSD],
    lusdAmount.isZero || isLusdApprovedWithBlusdAmm ? [] : [BLusdAmmTokenIndex.LUSD]
  ].flat();

  const areInputTokensApprovedWithBLusdAmm = tokensNeedingApproval.length === 0;

  const handleApprovePressed = () => {
    dispatchEvent("APPROVE_PRESSED", { tokensNeedingApproval });
  };

  const handleConfirmPressed = () => {
    dispatchEvent("CONFIRM_PRESSED", {
      action: "addLiquidity",
      bLusdAmount,
      lusdAmount,
      minLpTokens: Decimal.ZERO // TODO
    });
  };

  const handleBackPressed = () => {
    dispatchEvent("BACK_PRESSED");
  };

  useEffect(() => {
    if (bLusdAmount.isZero && lusdAmount.isZero) {
      setLpTokens(Decimal.ZERO);
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      try {
        const expectedLpTokens = await getExpectedLpTokens(bLusdAmount, lusdAmount);
        if (cancelled) return;
        setLpTokens(expectedLpTokens);
      } catch (error) {
        console.error("getExpectedLpTokens() failed");
        console.log(error);
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      cancelled = true;
    };
  }, [bLusdAmount, lusdAmount, getExpectedLpTokens]);

  return (
    <>
      <EditableRow
        label="Deposit #1"
        inputId="deposit-blusd"
        amount={bLusdAmount.prettify(2)}
        unit="bLUSD"
        editingState={editingState}
        editedAmount={bLusdAmount.toString()}
        setEditedAmount={amount => setBLusdAmount(Decimal.from(amount))}
        maxAmount={coalescedBLusdBalance.toString()}
        maxedOut={bLusdAmount.eq(coalescedBLusdBalance)}
      />

      <EditableRow
        label="Deposit #2"
        inputId="deposit-lusd"
        amount={lusdAmount.prettify(2)}
        unit="LUSD"
        editingState={editingState}
        editedAmount={lusdAmount.toString()}
        setEditedAmount={amount => setLusdAmount(Decimal.from(amount))}
        maxAmount={coalescedLusdBalance.toString()}
        maxedOut={lusdAmount.eq(coalescedLusdBalance)}
      />

      <Flex sx={{ justifyContent: "center", mb: 3 }}>
        <Icon name="arrow-down" size="lg" />
      </Flex>

      <DisabledEditableRow
        label="Mint LP tokens"
        inputId="deposit-mint-lp-tokens"
        amount={lpTokens.prettify(2)}
      />

      <PoolDetails />

      {isAnyBalanceInsufficient && (
        <ErrorDescription>
          Deposit exceeds your balance by{" "}
          {isBLusdBalanceInsufficient && (
            <>
              <Amount>{bLusdAmount.sub(coalescedBLusdBalance).prettify(2)} bLUSD</Amount>
              {isLusdBalanceInsufficient && <> and </>}
            </>
          )}
          {isLusdBalanceInsufficient && (
            <Amount>{lusdAmount.sub(coalescedLusdBalance).prettify(2)} LUSD</Amount>
          )}
        </ErrorDescription>
      )}

      <Flex variant="layout.actions">
        <Button
          variant="cancel"
          onClick={handleBackPressed}
          disabled={isApprovePending || isManageLiquidityPending}
        >
          Back
        </Button>

        {areInputTokensApprovedWithBLusdAmm ? (
          <Button
            variant="primary"
            onClick={handleConfirmPressed}
            disabled={
              (bLusdAmount.isZero && lusdAmount.isZero) ||
              isAnyBalanceInsufficient ||
              isManageLiquidityPending
            }
          >
            {isManageLiquidityPending ? (
              <Spinner size="28px" sx={{ color: "white" }} />
            ) : (
              <>Confirm</>
            )}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleApprovePressed} disabled={isApprovePending}>
            {isApprovePending ? <Spinner size="28px" sx={{ color: "white" }} /> : <>Approve</>}
          </Button>
        )}
      </Flex>
    </>
  );
};
