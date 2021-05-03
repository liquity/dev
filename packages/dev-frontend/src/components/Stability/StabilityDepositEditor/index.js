import { useState, useCallback } from "react";
import cn from "classnames";

import { Decimal, Difference } from "@liquity/lib-base";

import { useLiquitySelector } from "@liquity/lib-react";

import { COIN, GT } from "../../../strings";

import { LoadingOverlay } from "../../LoadingOverlay";
import StaticRow from "../../StaticRow";
import Modal from "../../Modal";
import Input from "../../Input";
import StabilityDepositAction from "../StabilityDepositAction";
import Button from "../../Button";
import ClaimAndMove from "../actions/ClaimAndMove";
import ClaimRewards from "../actions/ClaimRewards";
import ErrorDescription from "../../ErrorDescription";
import { Amount } from "../../ActionDescription";

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
  view,
  dispatchEvent,
  error
}) => {
  const { lusdBalance, lusdInStabilityPool, stabilityDeposit } = useLiquitySelector(select);
  const [stake, setStake] = useState(null);
  const [increment, setIncrement] = useState(null);
  const [decrement, setDecrement] = useState(null);

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

  const hasReward = !stabilityDeposit.lqtyReward.isZero;
  const hasGain = !stabilityDeposit.collateralGain.isZero;

  const liquidationGain = originalDeposit.isEmpty ? Decimal.ZERO : originalDeposit.collateralGain;

  const reward = originalDeposit.isEmpty ? Decimal.ZERO : stabilityDeposit.lqtyReward;

  console.log(editedLUSD);

  return (
    <div className={classes.wrapper}>
      {stake !== null && (
        <Modal title="STAKE LUSD" onClose={() => setModal(null)}>
          <div className={classes.modalContent}>
            <Input
              label="Stake"
              unit={COIN}
              icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"}
              value={stake}
              onChange={v => {
                setStake(v);
                dispatch({ type: "setDeposit", newValue: v });
              }}
              placeholder={Decimal.from(stake || 0).prettify(2)}
            />

            {error}

            {validChange ? (
              <StabilityDepositAction transactionId={transactionId} change={validChange} />
            ) : (
              <Button large primary disabled>
                Confirm
              </Button>
            )}

            <StaticRow label="Pool share" amount={newPoolShare.prettify(1)} unit="%" />
          </div>
        </Modal>
      )}

      {increment !== null && (
        <Modal
          title="STAKE LUSD"
          onClose={() => {
            setIncrement(null);
            dispatchEvent("CANCEL_PRESSED");
            dispatch({ type: "revert" });
          }}
        >
          <div className={classes.modalContent}>
            <Input
              label="stake"
              unit={GT}
              icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"}
              value={increment}
              onChange={v => {
                setIncrement(v);
                dispatch({ type: "increment", newValue: v });
              }}
              placeholder={Decimal.from(increment || 0).prettify(2)}
            />

            {error}

            <div className={classes.modalActions}>
              {validChange && !editedLUSD.gt(lusdBalance) ? (
                <StabilityDepositAction transactionId={transactionId} change={validChange} />
              ) : (
                <Button large primary disabled>
                  Confirm
                </Button>
              )}
            </div>

            <StaticRow label="Staked" amount={editedLUSD.prettify(2)} unit={COIN} />
          </div>
        </Modal>
      )}

      {decrement !== null && (
        <Modal
          title="UNSTAKE LUSD"
          onClose={() => {
            setDecrement(null);
            dispatchEvent("CANCEL_PRESSED");
            dispatch({ type: "revert" });
          }}
        >
          <div className={classes.modalContent}>
            <Input
              label="unstake"
              unit={GT}
              icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"}
              value={decrement}
              onChange={v => {
                setDecrement(v);
                dispatch({ type: "decrement", newValue: v });
              }}
              placeholder={Decimal.from(decrement || 0).prettify(2)}
            />

            {error}

            {Decimal.from(decrement || 0).gt(originalDeposit.currentLUSD) && (
              <ErrorDescription>
                The amount you're trying to unstake exceeds your stake by{" "}
                <Amount>
                  {Decimal.from(decrement).sub(originalDeposit.currentLUSD).prettify()} {GT}
                </Amount>
                .
              </ErrorDescription>
            )}

            <div className={classes.modalActions}>
              {validChange && editedLUSD.nonZero ? (
                <StabilityDepositAction transactionId={transactionId} change={validChange} />
              ) : (
                <Button large primary disabled>
                  Confirm
                </Button>
              )}
            </div>

            <StaticRow label="Staked" amount={editedLUSD.prettify(2)} unit={COIN} />
          </div>
        </Modal>
      )}

      <div className={classes.staticInfo}>
        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" amount="N/A" />
        ) : (
          <StaticRow label="Pool share" amount={originalPoolShare.prettify(4)} unit="%" />
        )}

        <StaticRow label="Liquidation gain" amount={liquidationGain.prettify(4)} unit="ETH" />

        <StaticRow label="Reward" amount={reward.prettify(2)} unit={GT} boldLabel />
      </div>

      <div className={classes.stakedWrapper}>
        {view !== "NONE" ? (
          <>
            <p className={classes.editLabel}>Staked</p>
            <p className={classes.editAmount}>
              {originalDeposit.currentLUSD.prettify(2)} {COIN}
            </p>
            <div className={classes.editActions}>
              <button
                onClick={() => {
                  dispatchEvent("ADJUST_DEPOSIT_PRESSED");
                  setDecrement("");
                }}
                disabled={originalDeposit.currentLUSD.isZero}
                className={cn({ [classes.disabled]: originalDeposit.currentLUSD.isZero })}
              >
                &#8722;
              </button>
              <button
                onClick={() => {
                  dispatchEvent("ADJUST_DEPOSIT_PRESSED");
                  setIncrement("");
                }}
                disabled={lusdBalance.isZero}
                className={cn({ [classes.disabled]: lusdBalance.isZero })}
              >
                &#43;
              </button>
            </div>
          </>
        ) : (
          <StaticRow
            labelColor="primary"
            label="Staked"
            amount={originalDeposit.currentLUSD.prettify(2)}
            unit={COIN}
          />
        )}
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
              setStake("");
              dispatchEvent("DEPOSIT_PRESSED");
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
