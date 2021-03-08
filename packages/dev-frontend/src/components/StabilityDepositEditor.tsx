import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import {
  Decimal,
  Decimalish,
  Difference,
  StabilityDeposit,
} from "@liquity/lib-base";

import { COIN, GT } from "../strings";

import { Icon } from "./Icon";
import { EditableRow, StaticRow } from "./Trove/Editor";
import { LoadingOverlay } from "./LoadingOverlay";

type StabilityDepositEditorProps = {
  title: string;
  originalDeposit: StabilityDeposit;
  editedLUSD: Decimal;
  changePending: boolean;
  dispatch: (
    action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }
  ) => void;
};

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  title,
  originalDeposit,
  editedLUSD,
  changePending,
  dispatch,
}) => {
  const editingState = useState<string>();

  const pendingDepositChange = Difference.between(
    editedLUSD,
    originalDeposit.currentLUSD.nonZero
  );
  const edited = !editedLUSD.eq(originalDeposit.currentLUSD);

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
          amount={editedLUSD.prettify()}
          pendingAmount={pendingDepositChange.nonZero?.prettify()}
          pendingColor={pendingDepositChange.positive ? "success" : "danger"}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedLUSD.toString(2)}
          setEditedAmount={(newValue) =>
            dispatch({ type: "setDeposit", newValue })
          }
        ></EditableRow>

        {!originalDeposit.isEmpty && (
          <>
            <StaticRow
              label="Gain"
              inputId="deposit-gain"
              amount={originalDeposit.collateralGain.prettify(4)}
              color={originalDeposit.collateralGain.nonZero && "success"}
              unit="ETH"
            />

            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.lqtyReward.prettify()}
              color={originalDeposit.lqtyReward.nonZero && "success"}
              unit={GT}
            />
          </>
        )}
      </Box>
    </Card>
  );
};
