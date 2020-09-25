import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Percent, Difference } from "@liquity/decimal";
import { Trove } from "@liquity/lib-base";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";

type TroveEditorProps = {
  title: string;
  original: Trove;
  edited: Trove;
  setEdited: (trove: Trove) => void;
  changePending: boolean;
  price: Decimal;
};

export const TroveEditor: React.FC<TroveEditorProps> = ({
  title,
  original,
  edited,
  setEdited,
  changePending,
  price
}) => {
  const editingState = useState<string>();

  const { collateralDifference, debtDifference } = original.whatChanged(edited);
  const isChanged = collateralDifference !== undefined || debtDifference !== undefined;

  const pendingCollateral = original.collateral.nonZero && collateralDifference;
  const pendingDebt = original.debt.nonZero && debtDifference;

  const collateralRatio =
    (edited.collateral.nonZero || edited.debt.nonZero) && edited.collateralRatio(price);
  const collateralRatioPct = new Percent(collateralRatio || { toString: () => "N/A" });
  const collateralRatioChange = Difference.between(
    edited.collateralRatio(price),
    original.collateralRatio(price).finite
  );
  const collateralRatioChangePct = new Percent(collateralRatioChange);

  return (
    <Card>
      <Heading>
        {title}
        {isChanged && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setEdited(original)}
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
            setEdited(edited.setCollateral(editedCollateral))
          }
        ></EditableRow>

        <EditableRow
          label="Debt"
          inputId="trove-debt"
          amount={edited.debt.prettify()}
          pendingAmount={pendingDebt?.prettify()}
          pendingColor={pendingDebt?.positive ? "danger" : "success"}
          unit="LQTY"
          {...{ editingState }}
          editedAmount={edited.debt.toString(2)}
          setEditedAmount={(editedDebt: string) => setEdited(edited.setDebt(editedDebt))}
        />

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
