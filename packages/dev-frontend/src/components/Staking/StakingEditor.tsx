import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import { Decimal, Decimalish, Difference, LiquityStoreState, STBLStake } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";

import { useStakingView } from "./context/StakingViewContext";

const select = ({ stblBalance, totalStakedSTBL }: LiquityStoreState) => ({
  stblBalance,
  totalStakedSTBL
});

type StakingEditorProps = {
  title: string;
  originalStake: STBLStake;
  editedSTBL: Decimal;
  dispatch: (action: { type: "setStake"; newValue: Decimalish } | { type: "revert" }) => void;
};

export const StakingEditor: React.FC<StakingEditorProps> = ({
  children,
  title,
  originalStake,
  editedSTBL,
  dispatch
}) => {
  const { stblBalance, totalStakedSTBL } = useLiquitySelector(select);
  const { changePending } = useStakingView();
  const editingState = useState<string>();

  const edited = !editedSTBL.eq(originalStake.stakedSTBL);

  const maxAmount = originalStake.stakedSTBL.add(stblBalance);
  const maxedOut = editedSTBL.eq(maxAmount);

  const totalStakedSTBLAfterChange = totalStakedSTBL.sub(originalStake.stakedSTBL).add(editedSTBL);

  const originalPoolShare = originalStake.stakedSTBL.mulDiv(100, totalStakedSTBL);
  const newPoolShare = editedSTBL.mulDiv(100, totalStakedSTBLAfterChange);
  const poolShareChange =
    originalStake.stakedSTBL.nonZero && Difference.between(newPoolShare, originalPoolShare).nonZero;

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
          inputId="stake-stbl"
          amount={editedSTBL.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={GT}
          {...{ editingState }}
          editedAmount={editedSTBL.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setStake", newValue })}
        />

        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" inputId="stake-share" amount="N/A" />
        ) : (
          <StaticRow
            label="Pool share"
            inputId="stake-share"
            amount={newPoolShare.prettify(4)}
            pendingAmount={poolShareChange?.prettify(4).concat("%")}
            pendingColor={poolShareChange?.positive ? "success" : "danger"}
            unit="%"
          />
        )}

        {!originalStake.isEmpty && (
          <>
            <StaticRow
              label="Redemption gain"
              inputId="stake-gain-eth"
              amount={originalStake.collateralGain.prettify(4)}
              color={originalStake.collateralGain.nonZero && "success"}
              unit="ETH"
            />

            <StaticRow
              label="Issuance gain"
              inputId="stake-gain-xbrl"
              amount={originalStake.xbrlGain.prettify()}
              color={originalStake.xbrlGain.nonZero && "success"}
              unit={COIN}
            />
          </>
        )}

        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
