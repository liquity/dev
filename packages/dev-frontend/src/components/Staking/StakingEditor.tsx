import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference, LQTYStake } from "@liquity/lib-base";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, Row, StaticAmounts } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

import { useStakingView } from "./context/StakingViewContext";

type StakingEditorProps = {
  title: string;
  originalStake: LQTYStake;
  editedLQTY: Decimal;
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StakingEditor: React.FC<StakingEditorProps> = ({
  children,
  title,
  originalStake,
  editedLQTY,
  dispatch
}) => {
  const { changePending } = useStakingView();
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

      <Box sx={{ p: [2, 3] }}>
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
        />

        {!originalStake.isEmpty && (
          <Row label="Gains" sx={{ flexDirection: "column", mt: [-2, -3], pb: [2, 3] }}>
            <StaticAmounts
              inputId="stake-gain-eth"
              amount={originalStake.collateralGain.prettify(4)}
              color={originalStake.collateralGain.nonZero && "success"}
              unit="ETH"
              sx={{ mb: 0 }}
            />

            <StaticAmounts
              inputId="stake-gain-lusd"
              amount={originalStake.lusdGain.prettify()}
              color={originalStake.lusdGain.nonZero && "success"}
              unit={COIN}
              sx={{ pt: 0 }}
            />
          </Row>
        )}

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
