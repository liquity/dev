import React, { useCallback, useEffect, useState } from "react";
import { Flex, Button, Box, Card, Heading } from "theme-ui";
import {
  LiquityStoreState,
  Decimal,
  Trove,
  LUSD_LIQUIDATION_RESERVE,
  Percent,
  Difference
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { ActionDescription } from "../ActionDescription";
import { useMyTransactionState } from "../Transaction";
import { TroveAction } from "./TroveAction";
import { useTroveView } from "./context/TroveViewContext";
import { COIN } from "../../strings";
import { Icon } from "../Icon";
import { InfoIcon } from "../InfoIcon";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";
import { EditableRow, StaticRow } from "./Editor";
import {
  selectForTroveChangeValidation,
  validateTroveChange
} from "./validation/validateTroveChange";

const selector = (state: LiquityStoreState) => {
  const { trove, fees, price, accountBalance } = state;
  return {
    trove,
    fees,
    price,
    accountBalance,
    validationContext: selectForTroveChangeValidation(state)
  };
};

const TRANSACTION_ID = "trove-adjustment";
const GAS_ROOM_ETH = Decimal.from(0.1);

const feeFrom = (original: Trove, edited: Trove, borrowingRate: Decimal): Decimal => {
  const change = original.whatChanged(edited, borrowingRate);

  if (change && change.type !== "invalidCreation" && change.params.borrowLUSD) {
    return change.params.borrowLUSD.mul(borrowingRate);
  } else {
    return Decimal.ZERO;
  }
};

export const Adjusting: React.FC = () => {
  const { dispatchEvent } = useTroveView();
  const { trove, fees, price, accountBalance, validationContext } = useLiquitySelector(selector);
  const borrowingRate = fees.borrowingRate();
  const editingState = useState<string>();
  const originalNetDebt = trove.debt.sub(LUSD_LIQUIDATION_RESERVE);

  const [collateral, setCollateral] = useState<Decimal>(trove.collateral);
  const [netDebt, setNetDebt] = useState<Decimal>(originalNetDebt);
  const isDirty = !collateral.eq(trove.collateral) || !netDebt.eq(originalNetDebt);
  const isDebtIncrease = netDebt.gt(originalNetDebt);
  const debtIncreaseAmount = isDebtIncrease ? netDebt.sub(originalNetDebt) : Decimal.ZERO;

  const fee = isDebtIncrease
    ? feeFrom(trove, new Trove(trove.collateral, trove.debt.add(debtIncreaseAmount)), borrowingRate)
    : Decimal.ZERO;
  const totalDebt = netDebt.add(LUSD_LIQUIDATION_RESERVE).add(fee);
  const maxBorrowingRate = borrowingRate.add(0.005);
  const updatedTrove = isDirty ? new Trove(collateral, totalDebt) : trove;
  const feePct = new Percent(borrowingRate);
  const maxEth = accountBalance.gt(GAS_ROOM_ETH) ? accountBalance.sub(GAS_ROOM_ETH) : Decimal.ZERO;
  const maxCollateral = collateral.add(maxEth);
  const collateralMaxedOut = collateral.eq(maxCollateral);
  const collateralRatio =
    !collateral.isZero && !netDebt.isZero ? updatedTrove.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, trove.collateralRatio(price));

  const [troveChange, description] = validateTroveChange(
    trove,
    updatedTrove,
    borrowingRate,
    validationContext
  );

  const transactionState = useMyTransactionState(TRANSACTION_ID);
  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const handleCancelPressed = useCallback(() => {
    dispatchEvent("CANCEL_ADJUST_TROVE_PRESSED");
  }, [dispatchEvent]);

  const reset = useCallback(() => {
    setCollateral(trove.collateral);
    setNetDebt(originalNetDebt);
  }, [trove.collateral, originalNetDebt]);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      dispatchEvent("TROVE_ADJUSTED");
    }
  }, [transactionState.type, dispatchEvent]);

  return (
    <Card>
      <Heading>
        Trove
        {isDirty && !isTransactionPending && (
          <Button variant="titleIcon" sx={{ ":enabled:hover": { color: "danger" } }} onClick={reset}>
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      <Box sx={{ p: [2, 3] }}>
        <EditableRow
          label="Collateral"
          inputId="trove-collateral"
          amount={collateral.prettify(4)}
          maxAmount={maxCollateral.toString()}
          maxedOut={collateralMaxedOut}
          editingState={editingState}
          unit="ETH"
          editedAmount={collateral.toString(4)}
          setEditedAmount={(amount: string) => setCollateral(Decimal.from(amount))}
        />

        <EditableRow
          label="Net debt"
          inputId="trove-net-debt-amount"
          amount={netDebt.prettify()}
          unit={COIN}
          editingState={editingState}
          editedAmount={netDebt.toString(2)}
          setEditedAmount={(amount: string) => setNetDebt(Decimal.from(amount))}
        />

        <StaticRow
          label="Liquidation Reserve"
          inputId="trove-liquidation-reserve"
          amount={`${LUSD_LIQUIDATION_RESERVE}`}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "200px" }}>
                  An amount set aside to cover the liquidator’s gas costs if your Trove needs to be
                  liquidated. The amount increases your debt and is refunded if you close your Trove
                  by fully paying off its net debt.
                </Card>
              }
            />
          }
        />

        <StaticRow
          label="Borrowing Fee"
          inputId="trove-borrowing-fee"
          amount={fee.prettify(2)}
          pendingAmount={feePct.toString(2)}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "240px" }}>
                  This amount is deducted from the borrowed amount as a one-time fee. There are no
                  recurring fees for borrowing, which is thus interest-free.
                </Card>
              }
            />
          }
        />

        <StaticRow
          label="Total debt"
          inputId="trove-total-debt"
          amount={totalDebt.prettify(2)}
          unit={COIN}
          infoIcon={
            <InfoIcon
              tooltip={
                <Card variant="tooltip" sx={{ width: "240px" }}>
                  The total amount of LUSD your Trove will hold.{" "}
                  {isDirty && (
                    <>
                      You will need to repay {totalDebt.sub(LUSD_LIQUIDATION_RESERVE).prettify(2)}{" "}
                      LUSD to reclaim your collateral ({LUSD_LIQUIDATION_RESERVE.toString()} LUSD
                      Liquidation Reserve excluded).
                    </>
                  )}
                </Card>
              }
            />
          }
        />

        <CollateralRatio value={collateralRatio} change={collateralRatioChange} />

        {description ?? (
          <ActionDescription>
            Adjust your Trove by modifying its collateral, debt, or both.
          </ActionDescription>
        )}

        <Flex variant="layout.actions">
          <Button variant="cancel" onClick={handleCancelPressed}>
            Cancel
          </Button>

          {troveChange ? (
            <TroveAction
              transactionId={TRANSACTION_ID}
              change={troveChange}
              maxBorrowingRate={maxBorrowingRate}
            >
              Confirm
            </TroveAction>
          ) : (
            <Button disabled>Confirm</Button>
          )}
        </Flex>
      </Box>
      {isTransactionPending && <LoadingOverlay />}
    </Card>
  );
};
