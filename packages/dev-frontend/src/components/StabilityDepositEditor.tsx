import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Difference } from "@liquity/decimal";
import { StabilityDeposit } from "@liquity/lib-base";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";
import { COIN } from "../strings";

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
    editedDeposit.current,
    originalDeposit.current.nonZero
  );

  const edited = originalDeposit.calculateDifference(editedDeposit) !== undefined;

  return (
    <Card>
      <Heading>
        {title}
        {edited && !changePending && (
          <Button
            variant="titleIcon"
            sx={{ ":enabled:hover": { color: "danger" } }}
            onClick={() => setEditedDeposit(originalDeposit)}
          >
            <Icon name="history" size="lg" />
          </Button>
        )}
      </Heading>

      {changePending && <LoadingOverlay />}

      <Box>
        <EditableRow
          label="Deposit"
          inputId="deposit-lqty"
          amount={editedDeposit.current.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedDeposit.current.toString(2)}
          setEditedAmount={(editedDeposit: string) =>
            setEditedDeposit(new StabilityDeposit({ initial: editedDeposit }))
          }
        ></EditableRow>

        {!originalDeposit.isEmpty && (
          <StaticRow
            label="Gain"
            inputId="deposit-gain"
            amount={originalDeposit.collateralGain.prettify(4)}
            color={originalDeposit.collateralGain.nonZero && "success"}
            unit="ETH"
          />
        )}
      </Box>
    </Card>
  );
};
