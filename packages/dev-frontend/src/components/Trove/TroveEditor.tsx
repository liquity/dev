import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import {
  Percent,
  Difference,
  Decimalish,
  Decimal,
  Trove,
  LiquityStoreState,
  TroveChange,
  LUSD_LIQUIDATION_RESERVE
} from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { CollateralRatio } from "./CollateralRatio";

type TroveEditorProps = {
  original: Trove;
  edited: Trove;
  borrowingRate: Decimal;
  change?: TroveChange<Decimal>;
  changePending: boolean;
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

const selectPrice = ({ price }: LiquityStoreState) => price;

const feeFrom = (
  change: TroveChange<Decimal> | undefined,
  borrowingRate: Decimal
): Decimal | undefined =>
  change && change.type !== "invalidCreation"
    ? change.params.borrowLUSD?.mul(borrowingRate)
    : undefined;

export const TroveEditor: React.FC<TroveEditorProps> = ({
  children,
  original,
  edited,
  borrowingRate,
  change,
  changePending,
  dispatch
}) => {
  const price = useLiquitySelector(selectPrice);

  const editingState = useState<string>();

  const fee = feeFrom(change, borrowingRate);
  const feePct = new Percent(borrowingRate);

  const pendingCollateral = Difference.between(edited.collateral, original.collateral.nonZero)
    .nonZero;
  const pendingDebt = Difference.between(edited.debt, original.debt.nonZero).nonZero;

  const originalCollateralRatio = !original.isEmpty ? original.collateralRatio(price) : undefined;
  const collateralRatio = !edited.isEmpty ? edited.collateralRatio(price) : undefined;
  const collateralRatioChange = Difference.between(collateralRatio, originalCollateralRatio);

  return (
    <Card>
      <Heading>
        Trove
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

      <Box sx={{ p: [2, 3] }}>
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
        />

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

        {original.isEmpty && (
          <StaticRow
            label="Liquidation reserve"
            inputId="trove-liquidation-reserve"
            amount={`${LUSD_LIQUIDATION_RESERVE}`}
            unit={COIN}
          />
        )}

        {fee && (
          <StaticRow
            label="Fee"
            inputId="trove-borrowing-fee"
            amount={fee.toString(2)}
            pendingAmount={feePct.toString(2)}
            unit={COIN}
          />
        )}

        <CollateralRatio value={collateralRatio} change={collateralRatioChange} />

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
