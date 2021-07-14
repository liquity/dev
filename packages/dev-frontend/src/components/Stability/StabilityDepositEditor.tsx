import React, { useState } from "react";
import { Heading, Box, Card, Button } from "theme-ui";

import {
  Decimal,
  Decimalish,
  StabilityDeposit,
  LiquityStoreState,
  Difference
} from "@liquity/lib-base";

import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../strings";

import { Icon } from "../Icon";
import { EditableRow, StaticRow } from "../Trove/Editor";
import { LoadingOverlay } from "../LoadingOverlay";
import { InfoIcon } from "../InfoIcon";

const select = ({ lusdBalance, lusdInStabilityPool, stabilityDeposit }: LiquityStoreState) => ({
  lusdBalance,
  lusdInStabilityPool,
  stabilityDeposit
});

type StabilityDepositEditorProps = {
  originalDeposit: StabilityDeposit;
  editedLUSD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void;
};

const selectPrice = ({ price }: LiquityStoreState) => price;

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  originalDeposit,
  editedLUSD,
  changePending,
  dispatch,
  children
}) => {
  const { lusdBalance, lusdInStabilityPool, stabilityDeposit } = useLiquitySelector(select);
  const editingState = useState<string>();
  const price = useLiquitySelector(selectPrice);

  const edited = !editedLUSD.eq(originalDeposit.currentLUSD);

  const maxAmount = originalDeposit.currentLUSD.add(lusdBalance);
  const maxedOut = editedLUSD.eq(maxAmount);

  const lusdInStabilityPoolAfterChange = lusdInStabilityPool
    .sub(originalDeposit.currentLUSD)
    .add(editedLUSD);

  const originalPoolShare = originalDeposit.currentLUSD.mulDiv(100, lusdInStabilityPool);
  const newPoolShare = editedLUSD.mulDiv(100, lusdInStabilityPoolAfterChange);
  const poolShareChange =
    originalDeposit.currentLUSD.nonZero &&
    Difference.between(newPoolShare, originalPoolShare).nonZero;

  const {bammPoolShare, collateralGain} = stabilityDeposit;

  const userTotalUsdInBamm = (originalDeposit.currentLUSD.add(collateralGain.mul(price)))
  const totalLusdInBamm = userTotalUsdInBamm.mulDiv(100, bammPoolShare);
  const editedUserLusd = userTotalUsdInBamm.sub(originalDeposit.currentLUSD).add(editedLUSD);
  const editedTotalLusd = totalLusdInBamm.sub(originalDeposit.currentLUSD).add(editedLUSD);
  const editedBammPoolShare = editedUserLusd.mulDiv(100, editedTotalLusd)

  const bammPoolShareChange =
    originalDeposit.currentLUSD.nonZero &&
    Difference.between(editedBammPoolShare, bammPoolShare).nonZero;
 
  return (
    <Card>
      <Heading>
        Stability Pool
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
          label="Deposit"
          inputId="deposit-lqty"
          amount={editedLUSD.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedLUSD.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setDeposit", newValue })}
        />

        {!originalDeposit.isEmpty && (
          <>
            <StaticRow
              label="my share in ETH"
              inputId="deposit-gain"
              amount={originalDeposit.collateralGain.prettify(4)}
              color={originalDeposit.collateralGain.nonZero && "success"}
              unit="ETH"
            />

          {newPoolShare.infinite ? (
            <StaticRow label="Pool share" inputId="deposit-share" amount="N/A" />
          ) : (
            <StaticRow
              label="Pool share"
              inputId="deposit-share"
              amount={newPoolShare.prettify(4)}
              pendingAmount={poolShareChange?.prettify(4).concat("%")}
              pendingColor={poolShareChange?.positive ? "success" : "danger"}
              unit="%"
            />
          )}

          {bammPoolShare.infinite ? (
            <StaticRow label="Pool share" inputId="deposit-share" amount="N/A" />
          ) : (
            <StaticRow
              label="BAMM Pool share"
              inputId="deposit-share"
              amount={editedBammPoolShare.prettify(4)}
              pendingAmount={bammPoolShareChange?.prettify(4).concat("%")}
              pendingColor={bammPoolShareChange?.positive ? "success" : "danger"}
              unit="%"
            />
          )}
          
            <StaticRow
              label="Reward"
              inputId="deposit-reward"
              amount={originalDeposit.lqtyReward.prettify()}
              color={originalDeposit.lqtyReward.nonZero && "success"}
              unit={GT}
              infoIcon={
                <InfoIcon
                  tooltip={
                    <Card variant="tooltip" sx={{ width: "240px" }}>
                      Although the LQTY rewards accrue every minute, the value on the UI only updates
                      when a user transacts with the Stability Pool. Therefore you may receive more
                      rewards than is displayed when you claim or adjust your deposit.
                    </Card>
                  }
                />
              }
            />
          </>
        )}
        {children}
      </Box>

      {changePending && <LoadingOverlay />}
    </Card>
  );
};
