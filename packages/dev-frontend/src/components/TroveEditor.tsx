import React, { useState } from "react";
import { Heading, Box, Card, Spinner, Link } from "theme-ui";

import { Decimal, Percent, Difference } from "@liquity/decimal";
import { Trove, Liquity } from "@liquity/lib";
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
    <Card p={0}>
      <Heading
        as="h3"
        sx={{
          bg: "lightgrey",
          pl: 3,
          py: 2,
          pr: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        {title}
        <Box sx={{ width: "40px", height: "40px" }}>
          {isChanged && !changePending && (
            <Link
              sx={{
                color: "text",
                "&:hover": { color: "danger" },
                "&:active": { color: "danger" },
                display: "flex",
                alignItems: "center"
              }}
              onClick={() => setEdited(original)}
            >
              <Icon name="history" size="lg" />
            </Link>
          )}
        </Box>
      </Heading>

      {changePending && (
        <LoadingOverlay>
          <Spinner size="24px" color="text" />
        </LoadingOverlay>
      )}

      <Box p={2}>
        <EditableRow
          label="Collateral"
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
          amount={
            collateralRatio?.gt(10)
              ? "× " + collateralRatio.shorten()
              : collateralRatioPct.prettify()
          }
          color={
            collateralRatio?.gt(Liquity.CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : collateralRatio?.gt(Liquity.MINIMUM_COLLATERAL_RATIO)
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
