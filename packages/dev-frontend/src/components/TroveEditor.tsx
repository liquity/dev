import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Percent, Difference, Decimalish, Decimal } from "@liquity/decimal";
import {
  CRITICAL_COLLATERAL_RATIO,
  MINIMUM_COLLATERAL_RATIO,
  Trove,
  LiquityStoreState,
  TroveChange
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../strings";

import { Icon } from "./Icon";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";

type TroveEditorProps = {
  original: Trove;
  edited: Trove;
  afterFee: Trove;
  borrowingRate: Decimal;
  change?: TroveChange<Decimal>;
  changePending: boolean;
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

const selectPrice = ({ price }: LiquityStoreState) => price;

export const TroveEditor: React.FC<TroveEditorProps> = ({
  children,
  original,
  edited,
  afterFee,
  borrowingRate,
  change,
  changePending,
  dispatch
}) => {
  const price = useLiquitySelector(selectPrice);

  const editingState = useState<string>();

  const fee = afterFee.subtract(edited).debt.nonZero;
  const feePct = new Percent(borrowingRate);

  const pendingCollateral = Difference.between(edited.collateral, original.collateral.nonZero)
    .nonZero;
  const pendingDebt = Difference.between(edited.debt, original.debt.nonZero).nonZero;

  const originalCollateralRatio = !original.isEmpty ? original.collateralRatio(price) : undefined;
  const collateralRatio = !afterFee.isEmpty ? afterFee.collateralRatio(price) : undefined;
  const collateralRatioPct = new Percent(collateralRatio || { toString: () => "N/A" });
  const collateralRatioChange = Difference.between(collateralRatio, originalCollateralRatio);
  const collateralRatioChangePct = collateralRatioChange && new Percent(collateralRatioChange);

  return (
    <Card>
      <Heading>
        {original.isEmpty ? "Open a Trove to borrow LUSD" : "My Trove"}
        {change && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => dispatch({ type: "revert" })}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {changePending && <LoadingOverlay />}

      {children}

      <Box>
        <EditableRow
          label="Collateral"
          inputId="trove-collateral"
          amount={edited.collateral.prettify(4)}
          pendingAmount={pendingCollateral?.prettify()}
          pendingColor={pendingCollateral?.positive ? "success" : "danger"}
          unit="ETH"
          {...{ editingState }}
          editedAmount={edited.collateral.toString(4)}
          setEditedAmount={(editedCollateral: string) =>
            dispatch({ type: "setCollateral", newValue: editedCollateral })
          }
        ></EditableRow>

        <EditableRow
          label="Debt"
          inputId="trove-debt"
          amount={edited.debt.prettify()}
          pendingAmount={pendingDebt?.prettify()}
          pendingColor={pendingDebt?.positive ? "danger" : "success"}
          unit={COIN}
          {...{ editingState }}
          editedAmount={edited.debt.toString(2)}
          setEditedAmount={(editedDebt: string) =>
            dispatch({ type: "setDebt", newValue: editedDebt })
          }
        />

        {fee && (
          <StaticRow
            label="Fee"
            inputId="trove-borrowing-fee"
            amount={fee.toString(2)}
            color="danger"
            pendingAmount={feePct.toString(2)}
            pendingColor="danger"
            unit={COIN}
          />
        )}

        <StaticRow
          label="Collateral ratio"
          inputId="trove-collateral-ratio"
          amount={
            collateralRatio?.gt(10)
              ? "× " + collateralRatio.shorten()
              : collateralRatioPct.prettify()
          }
          color={
            collateralRatio?.gt(CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : collateralRatio?.gt(MINIMUM_COLLATERAL_RATIO)
              ? "warning"
              : collateralRatio?.lte(MINIMUM_COLLATERAL_RATIO)
              ? "danger"
              : "muted"
          }
          pendingAmount={
            collateralRatioChange.positive?.absoluteValue?.gt(10)
              ? "++"
              : collateralRatioChange.negative?.absoluteValue?.gt(10)
              ? "--"
              : collateralRatioChangePct.nonZeroish(2)?.prettify()
          }
          pendingColor={collateralRatioChange.positive ? "success" : "danger"}
        />
      </Box>
    </Card>
  );
};
