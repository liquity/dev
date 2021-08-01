import React, { useState } from "react";
import { Heading, Box, Card, Button, Flex } from "theme-ui";
import { ActionDescription } from "../ActionDescription";

import {
  selectForStabilityDepositChangeValidation,
  validateStabilityDepositChange
} from "./validation/validateStabilityDepositChange";

import { useMyTransactionState } from "../Transaction";
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
  editedUSD: Decimal;
  changePending: boolean;
  dispatch: (action: { type: "setDeposit"; newValue: Decimalish } | { type: "revert" }) => void;
};

const selectPrice = ({ price }: LiquityStoreState) => price;

export const StabilityDepositEditor: React.FC<StabilityDepositEditorProps> = ({
  originalDeposit,
  editedUSD,
  changePending,
  dispatch,
  children
}) => {
  const { lusdBalance, lusdInStabilityPool, stabilityDeposit } = useLiquitySelector(select);
  const editingState = useState<string>();
  const price = useLiquitySelector(selectPrice);
  const validationContext = useLiquitySelector(selectForStabilityDepositChangeValidation);


  const edited = !editedUSD.eq(stabilityDeposit.currentUSD);

  const maxAmount = stabilityDeposit.currentUSD.add(lusdBalance);
  const maxedOut = editedUSD.eq(maxAmount);

  const ethInUsd = originalDeposit.currentUSD.sub(stabilityDeposit.currentLUSD)
  
  const originalPoolShare = originalDeposit.currentLUSD.mulDiv(100, lusdInStabilityPool);

  const {bammPoolShare, collateralGain} = stabilityDeposit;

  const userTotalUsdInBamm = stabilityDeposit.currentUSD
  const totalUsdInBamm = userTotalUsdInBamm.mulDiv(100, bammPoolShare);
  const editedUserUsd = userTotalUsdInBamm.sub(stabilityDeposit.currentUSD).add(editedUSD);
  const editedTotalUsdInBamm = totalUsdInBamm.sub(stabilityDeposit.currentUSD).add(editedUSD);
  const editedBammPoolShare = editedUserUsd.mulDiv(100, editedTotalUsdInBamm)
  
  /* USD balance
  ====================================================================*/
  const usdDiff = Difference.between(editedUSD, stabilityDeposit.currentUSD)

  const bammPoolShareChange =
    stabilityDeposit.currentUSD.nonZero &&
    Difference.between(editedBammPoolShare, bammPoolShare).nonZero;

  let newTotalLusd, newTotalEth;
  if(bammPoolShareChange && !bammPoolShareChange?.nonZero || bammPoolShareChange?.positive){
    newTotalLusd = stabilityDeposit.totalLusdInBamm.add(Decimal.from(usdDiff.absoluteValue||0));
    newTotalEth = stabilityDeposit.totalEthInBamm;
  } else {
    newTotalLusd = stabilityDeposit.totalLusdInBamm.mul((editedTotalUsdInBamm.div(totalUsdInBamm)))
    newTotalEth = stabilityDeposit.totalEthInBamm.mul((editedTotalUsdInBamm.div(totalUsdInBamm)))
  }

  const allowanceTxState = useMyTransactionState("bamm-unlock");
  const waitingForTransaction =
    allowanceTxState.type === "waitingForApproval" ||
    allowanceTxState.type === "waitingForConfirmation";

  /* ETH balance
  ====================================================================*/
  const newEthBalance = editedBammPoolShare.mul(newTotalEth).div(100)
  const ethDiff = Difference.between(newEthBalance, stabilityDeposit.collateralGain).nonZero

  /* LUSD balance
  ====================================================================*/
  const newLusdBalance = editedBammPoolShare.mul(newTotalLusd).div(100)
  const lusdDiff = Difference.between(newLusdBalance, stabilityDeposit.currentLUSD).nonZeroish(16)
  
  const [, description] = validateStabilityDepositChange(
    originalDeposit,
    editedUSD,
    validationContext,
    lusdDiff,
    ethDiff,
  );
  const makingNewDeposit = originalDeposit.isEmpty;

  /* pool share
  ====================================================================*/
  const lusdInStabilityPoolAfterChange = lusdInStabilityPool
    .add(newTotalLusd)
    .sub(stabilityDeposit.totalLusdInBamm);

  const newPoolShare = (newTotalLusd.mulDiv(editedBammPoolShare, 100)).mulDiv(100, lusdInStabilityPoolAfterChange);
  const poolShareChange =
    originalDeposit.currentLUSD.nonZero &&
    Difference.between(newPoolShare, originalPoolShare).nonZero;
  

  const ethDiffInUsd = stabilityDeposit.currentUSD.sub(stabilityDeposit.currentLUSD)
  const ethIsImportant = (ethDiffInUsd.div(stabilityDeposit.currentUSD)).gt(1/1000)
  return (
    <Card>
      <Heading>
        Stability Pool
        {edited && (!changePending && !waitingForTransaction) && (
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
          amount={editedUSD.prettify()}
          maxAmount={maxAmount.toString()}
          maxedOut={maxedOut}
          unit={COIN}
          {...{ editingState }}
          editedAmount={editedUSD.toString(2)}
          setEditedAmount={newValue => dispatch({ type: "setDeposit", newValue })}
        />

        {!originalDeposit.isEmpty && (
          <>
          <Flex sx={{ justifyContent: 'space-between', flexWrap: "wrap" }}>
            <StaticRow
                label="LUSD balance"
                inputId="deposit-gain"
                amount={newLusdBalance.prettify(2)}
                unit="LUSD"
                pendingAmount={lusdDiff?.prettify(2).concat("LUSD")}
                pendingColor={lusdDiff?.positive ? "success" : "danger"}
            />

            {ethIsImportant && <StaticRow
              label="ETH balance"
              inputId="deposit-gain"
              amount={newEthBalance.prettify(4)}
              unit="ETH"
              pendingAmount={ethDiff?.prettify(4).concat("ETH")}
              pendingColor={ethDiff?.positive ? "success" : "danger"}
              infoIcon={
                <InfoIcon
                  tooltip={
                    <Card variant="tooltip" sx={{ width: "240px" }}>
                    Temporary ETH balance until rebalance takes place
                    </Card>
                  }
                />
              }
            />
          }
          </Flex>
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
          <div className="hide" >
            {bammPoolShare.infinite ? (
              <StaticRow label="BAMM Pool share" inputId="deposit-share" amount="N/A" />
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
          </div>
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
        {description ??
          (makingNewDeposit ? (
            <ActionDescription>Enter the amount of {COIN} you'd like to deposit.</ActionDescription>
          ) : (
            <ActionDescription>Adjust the {COIN} amount to deposit or withdraw.</ActionDescription>
          ))}
        {children}
      </Box>

      {changePending || waitingForTransaction && <LoadingOverlay />}
    </Card>
  );
};
