import React, { useState } from "react";
import { Heading, Box, Card, Link, Icon, Loader } from "rimble-ui";

import { StabilityDeposit } from "@liquity/lib";
import { Difference } from "@liquity/lib/dist/utils";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";

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
      <Heading
        as="h3"
        bg="lightgrey"
        pl={3}
        py={2}
        pr={2}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
      >
        {title}
        <Box width="40px" height="40px">
          {edited && !changePending && (
            <Link
              color="text"
              hoverColor="danger"
              activeColor="danger"
              display="flex"
              alignItems="center"
              onClick={() => setEditedDeposit(originalDeposit)}
            >
              <Icon name="Replay" size="40px" />
            </Link>
          )}
        </Box>
      </Heading>

      {changePending && (
        <LoadingOverlay>
          <Loader size="24px" color="text" />
        </LoadingOverlay>
      )}

      <Box p={2}>
        <EditableRow
          label="Deposit"
          amount={editedDeposit.depositAfterLoss.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit="QUI"
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
