import { useState, useCallback } from "react";
import { Box, Card } from "theme-ui";

import { Decimal, Difference } from "@liquity/lib-base";

import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../../strings";

import { EditableRow } from "../../Trove/Editor";
import { LoadingOverlay } from "../../LoadingOverlay";
import { InfoIcon } from "../../InfoIcon";
import StaticRow from "../../StaticRow";
import Modal from "../../Modal";
import Input from "../../Input";
import StabilityDepositAction from "../StabilityDepositAction";
import Button from "../../Button";
import ClaimAndMove from "../actions/ClaimAndMove";
import ClaimRewards from "../actions/ClaimRewards";

import classes from "./StabilityDepositEditor.module.css";

const select = ({ lusdBalance, lusdInStabilityPool, stabilityDeposit }) => ({
  lusdBalance,
  lusdInStabilityPool,
  stabilityDeposit
});

export const StabilityDepositEditor = ({
  originalDeposit,
  editedLUSD,
  changePending,
  dispatch,
  children,
  modal,
  setModal,
  validChange,
  transactionId,
  view
}) => {
  const { lusdBalance, lusdInStabilityPool, stabilityDeposit } = useLiquitySelector(select);
  const editingState = useState();
  const [lqty, setLqty] = useState("");

  const edited = !editedLUSD.eq(originalDeposit.currentLUSD);

  const maxAmount = originalDeposit.currentLUSD.add(lusdBalance);
  const maxedOut = editedLUSD.eq(maxAmount);

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent, view]);

  const lusdInStabilityPoolAfterChange = lusdInStabilityPool
    .sub(originalDeposit.currentLUSD)
    .add(editedLUSD);

  const originalPoolShare = originalDeposit.currentLUSD.mulDiv(100, lusdInStabilityPool);
  const newPoolShare = editedLUSD.mulDiv(100, lusdInStabilityPoolAfterChange);
  const poolShareChange =
    originalDeposit.currentLUSD.nonZero &&
    Difference.between(newPoolShare, originalPoolShare).nonZero;

  const hasReward = !stabilityDeposit.lqtyReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;

  const staticPoolShare =
    view === "NONE"
      ? Decimal.ZERO.prettify(2)
      : newPoolShare?.prettify(4) || Decimal.ZERO.prettify(2);

  const staticLiquidationGain =
    view === "NONE"
      ? originalDeposit.isEmpty
        ? Decimal.ZERO.prettify(2)
        : originalDeposit.collateralGain.prettify(4)
      : stabilityDeposit.collateralGain.prettify(4);

  const staticReward =
    view === "NONE" ? Decimal.ZERO.prettify(2) : stabilityDeposit.lqtyReward.prettify();

  return (
    <div className={classes.wrapper}>
      {modal && (
        <Modal title="STAKE LUSD" onClose={() => setModal(null)}>
          <div className={classes.modalContent}>
            <Input
              label="Stake"
              unit={GT}
              icon={process.env.PUBLIC_URL + "/icons/LQTY icon.png"}
              value={lqty}
              onChange={v => {
                setLqty(v);
                dispatch({ type: "setDeposit", newValue: v });
              }}
              placeholder={Decimal.from(lqty || 0).prettify(2)}
            />
            <StaticRow label="Pool share" amount={newPoolShare.prettify(1)} unit="%" />
            {validChange ? (
              <StabilityDepositAction transactionId={transactionId} change={validChange} />
            ) : (
              <Button large primary disabled>
                Confirm
              </Button>
            )}
          </div>
        </Modal>
      )}

      <div className={classes.staticInfo}>
        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" amount="N/A" />
        ) : (
          <StaticRow label="Pool share" amount={staticPoolShare} unit="%" />
        )}

        <StaticRow label="Liquidation gain" amount={staticLiquidationGain} unit="ETH" />

        <StaticRow label="Reward" amount={staticReward} unit={GT} boldLabel />
      </div>

      <div className={classes.stakedWrapper}>
        <StaticRow
          labelColor="primary"
          label="Staked"
          amount={originalDeposit.currentLUSD.prettify(0)}
          unit={COIN}
        />
      </div>

      <div className={classes.actions}>
        {["ACTIVE", "ADJUSTING"].includes(view) ? (
          <>
            <ClaimRewards disabled={!hasGain && !hasReward} />
            <ClaimAndMove disabled={!hasGain} />
          </>
        ) : (
          <Button
            primary
            large
            uppercase
            onClick={() => {
              handleOpenTrove();
              setModal(true);
            }}
          >
            Stake
          </Button>
        )}
      </div>

      {children}

      {changePending && <LoadingOverlay />}
    </div>
  );
};

//<Card variant="tooltip" sx={{ width: "240px" }}>
//Although the LQTY rewards accrue every minute, the value on the UI only updates
//when a user transacts with the Stability Pool. Therefore you may receive more
//rewards than is displayed when you claim or adjust your deposit.
//</Card>
