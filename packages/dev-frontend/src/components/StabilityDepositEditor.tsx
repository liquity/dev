import React, { useState } from "react";
import { Heading, Box, Card, Button, Spinner } from "theme-ui";

import { Difference } from "@liquity/decimal";
import { StabilityDeposit } from "@liquity/lib";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";

type StabilityDepositEditorProps = {
  title: string;
  originalDeposit: StabilityDeposit;
  editedDeposit: StabilityDeposit;
  setEditedDeposit: (deposit: StabilityDeposit) => void;
  changePending: boolean;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  title,
  originalDeposit,
  editedDeposit,
  setEditedDeposit,
  changePending
}) => {
  const editingState = useState<string>();

  const pendingDepositChange = Difference.between(
    editedDeposit.depositAfterLoss,
    originalDeposit.depositAfterLoss.nonZero
  );

  const edited = originalDeposit.calculateDifference(editedDeposit) !== undefined;

  return (
    <Card p={0}>
      <Heading variant="editorTitle">
        {title}
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ "&:hover": { color: "danger" } }}
            onClick={() => setEditedDeposit(originalDeposit)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {changePending && (
        <LoadingOverlay>
          <Spinner size="24px" color="text" />
        </LoadingOverlay>
      )}

      <Box p={2}>
        <EditableRow
          label="Deposit"
          amount={editedDeposit.depositAfterLoss.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit="LQTY"
          {...{ editingState }}
          editedAmount={editedDeposit.depositAfterLoss.toString(2)}
          setEditedAmount={(editedDeposit: string) =>
            setEditedDeposit(new StabilityDeposit({ deposit: editedDeposit }))
          }
        ></EditableRow>

        {!originalDeposit.isEmpty && (
          <StaticRow
            label="Gain"
            amount={originalDeposit.pendingCollateralGain.prettify(4)}
            color={originalDeposit.pendingCollateralGain.nonZero && "success"}
            unit="ETH"
          />
        )}
      </Box>
    </Card>
  );
};
