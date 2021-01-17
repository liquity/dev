import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference } from "@liquity/decimal";
import { LQTYStake } from "@liquity/lib-base";
import { EditableRow, StaticRow } from "./Editor";
import { LoadingOverlay } from "./LoadingOverlay";
import { Icon } from "./Icon";
import { COIN, GT } from "../strings";

type StakingEditorProps = {
  title: string;
  originalStake: LQTYStake;
  editedLQTY: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StakingEditor: React.FC<StakingEditorProps> = ({
  title,
  originalStake,
  editedLQTY,
  changePending,
  dispatch
}) => {
  const editingState = useState<string>();

  const pendingStakeChange = Difference.between(editedLQTY, originalStake.stakedLQTY.nonZero);
  const edited = !editedLQTY.eq(originalStake.stakedLQTY);

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
          label="Stake"
          inputId="stake-lqty"
          amount={editedLQTY.prettify()}
          pendingAmount={pendingStakeChange.nonZero?.prettify()}
          pendingColor={pendingStakeChange.positive ? "success" : "danger"}
          unit={GT}
          {...{ editingState }}
          editedAmount={editedLQTY.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setStake", newValue })}
        ></EditableRow>

        {!originalStake.isEmpty && (
          <StaticRow
            label="Gain"
            inputId="stake-gain-lusd"
            amount={originalStake.lusdGain.prettify()}
            color={originalStake.lusdGain.nonZero && "success"}
            unit={COIN}
          />
        )}
      </Box>
    </Card>
  );
};
