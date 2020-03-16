import React, { useState } from "react";
import { Heading, Box, Card } from "rimble-ui";

import { StabilityDeposit } from "@liquity/lib";
import { Difference } from "@liquity/lib/dist/utils";
import { EditableRow, StaticRow } from "./Editor";

type StabilityDepositEditorProps = {
  title: string;
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  setEditedDeposit: (deposit: StabilityDeposit) => void;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  title,
  originalDeposit,
  editedDeposit,
  setEditedDeposit
}) => {
  const editingState = useState<string>();

  const pendingDepositChange = Difference.between(
    editedDeposit.depositAfterLoss,
    originalDeposit.deposit
  );

  const edited = originalDeposit.calculateDifference(editedDeposit) !== undefined;

  return (
    <Card p={0}>
      <Heading as="h3" p={3} bg="lightgrey">
        {title}
      </Heading>

      <Box p={2}>
        <EditableRow
          label="Deposit"
          amount={editedDeposit.depositAfterLoss.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit="QUI"
          {...{ edited }}
          {...{ editingState }}
          editedAmount={editedDeposit.depositAfterLoss.toString(2)}
          setEditedAmount={(editedDeposit: string) =>
            setEditedDeposit(new StabilityDeposit({ deposit: editedDeposit }))
          }
        ></EditableRow>

        <StaticRow
          label="Gain"
          amount={originalDeposit.pendingCollateralGain.prettify(4)}
          color={originalDeposit.pendingCollateralGain.nonZero && "success"}
          unit="ETH"
        />
      </Box>
    </Card>
  );
};
