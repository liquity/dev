import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Percent, Difference, Decimalish, Decimal } from "@liquity/decimal";
import { Trove, LiquityStoreState, TroveChange } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";
import { COIN } from "../strings";

type TroveEditorProps = {
  original: Trove;
  edited: Trove;
  afterFee: Trove;
  fee?: Decimal;
  change: TroveChange;
  changePending: boolean;
  dispatch: (
    action: { type: "setCollateral" | "setDebt"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

const selectPrice = ({ price }: LiquityStoreState) => price;

export const TroveEditor: React.FC<TroveEditorProps> = ({
  original,
  edited,
  afterFee,
  fee,
  change: { collateralDifference, debtDifference },
  changePending,
  dispatch
}) => {
  const price = useLiquitySelector(selectPrice);

  const editingState = useState<string>();

  const isChanged = collateralDifference !== undefined || debtDifference !== undefined;

  const pendingCollateral = original.collateral.nonZero && collateralDifference;
  const pendingDebt = original.debt.nonZero && debtDifference;

  const collateralRatio =
    (edited.collateral.nonZero || edited.debt.nonZero) && afterFee.collateralRatio(price);
  const collateralRatioPct = new Percent(collateralRatio || { toString: () => "N/A" });
  const collateralRatioChange = Difference.between(
    afterFee.collateralRatio(price),
    original.collateralRatio(price).finite
  );
  const collateralRatioChangePct = new Percent(collateralRatioChange);

  return (
    <Card>
      <Heading>
        {original.isEmpty ? "Open a new Liquity Trove" : "My Liquity Trove"}
        {isChanged && !changePending && (
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
            collateralRatio?.gt(Trove.CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : collateralRatio?.gt(Trove.MINIMUM_COLLATERAL_RATIO)
              ? "warning"
              : "danger"
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
