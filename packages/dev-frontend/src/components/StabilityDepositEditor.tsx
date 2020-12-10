import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference } from "@liquity/decimal";
import { StabilityDeposit } from "@liquity/lib-base";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";
import { COIN } from "../strings";

type StabilityDepositEditorProps = {
  title: string;
  originalDeposit: StabilityDeposit;
  editedDeposit: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  title,
  originalDeposit,
  editedDeposit,
  changePending,
  dispatch
}) => {
  const editingState = useState<string>();

  const pendingDepositChange = Difference.between(editedDeposit, originalDeposit.current.nonZero);
  const edited = !editedDeposit.eq(originalDeposit.current);

  return (
    <Card>
      <Heading>
        {title}
        {edited && !changePending && (
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
          label="Deposit"
          inputId="deposit-lqty"
          amount={editedDeposit.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedDeposit.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setDeposit", newValue })}
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
