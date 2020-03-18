import React, { useState } from "react";
import { Heading, Box, Card } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { Decimal, Percent, Difference } from "@liquity/lib/dist/utils";
import { EditableRow, StaticRow } from "./Editor";

type TroveEditorProps = {
  title: string;
  originalTrove?: Trove;
  editedTrove: Trove;
  setEditedTrove: (trove: Trove) => void;
  price: Decimal;
};

export const TroveEditor: React.FC<TroveEditorProps> = ({
  title,
  originalTrove,
  editedTrove,
  setEditedTrove,
  price
}) => {
  const editingState = useState<string>();

  const pendingCollateralChange = Difference.between(
    editedTrove.collateralAfterReward,
    originalTrove?.collateral
  );
  const pendingDebtChange = Difference.between(editedTrove.debtAfterReward, originalTrove?.debt);

  const collateralRatioAfterRewards =
    (editedTrove.collateralAfterReward.nonZero || editedTrove.debtAfterReward.nonZero) &&
    editedTrove.collateralRatioAfterRewardsAt(price);
  const collateralRatioPctAfterRewards = new Percent(
    collateralRatioAfterRewards || { toString: () => "N/A" }
  );
  const pendingCollateralRatioChange = Difference.between(
    editedTrove.collateralRatioAfterRewardsAt(price),
    originalTrove?.collateralRatioAt(price)
  );
  const pendingCollateralRatioChangePct = new Percent(pendingCollateralRatioChange);

  const edited = originalTrove?.whatChanged(editedTrove) !== undefined;

  return (
    <Card p={0}>
      <Heading as="h3" p={3} bg="lightgrey">
        {title}
      </Heading>

      <Box p={2}>
        <EditableRow
          label="Collateral"
          amount={editedTrove.collateralAfterReward.prettify(4)}
          pendingAmount={pendingCollateralChange.nonZero?.prettify()}
          pendingColor={pendingCollateralChange.positive ? "success" : "danger"}
          unit="ETH"
          {...{ edited }}
          {...{ editingState }}
          editedAmount={editedTrove.collateralAfterReward.toString(4)}
          setEditedAmount={(editedCollateral: string) =>
            setEditedTrove(editedTrove.setCollateral(editedCollateral))
          }
        ></EditableRow>

        <EditableRow
          label="Debt"
          amount={editedTrove.debtAfterReward.prettify()}
          pendingAmount={pendingDebtChange.nonZero?.prettify()}
          pendingColor={pendingDebtChange.positive ? "danger" : "success"}
          unit="QUI"
          {...{ edited }}
          {...{ editingState }}
          editedAmount={editedTrove.debtAfterReward.toString(2)}
          setEditedAmount={(editedDebt: string) => setEditedTrove(editedTrove.setDebt(editedDebt))}
        />

        <StaticRow
          label="Collateral ratio"
          amount={
            collateralRatioAfterRewards?.gt(10)
              ? "× " + collateralRatioAfterRewards.shorten()
              : collateralRatioPctAfterRewards.prettify()
          }
          color={
            collateralRatioAfterRewards?.gt(Liquity.CRITICAL_COLLATERAL_RATIO)
              ? "success"
              : collateralRatioAfterRewards?.gt(Liquity.MINIMUM_COLLATERAL_RATIO)
              ? "warning"
              : "danger"
          }
          pendingAmount={
            pendingCollateralRatioChange.positive?.absoluteValue?.gt(10)
              ? "++"
              : pendingCollateralRatioChange.negative?.absoluteValue?.gt(10)
              ? "--"
              : pendingCollateralRatioChangePct.nonZeroish(2)?.prettify()
          }
          pendingColor={pendingCollateralRatioChange.positive ? "success" : "danger"}
          {...{ edited }}
        />
      </Box>
    </Card>
  );
};
