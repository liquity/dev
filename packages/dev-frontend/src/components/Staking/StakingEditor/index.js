import { useState, useEffect } from "react";
import cn from "classnames";

import { Decimal } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { GT, COIN } from "../../../strings";

import { LoadingOverlay } from "../../LoadingOverlay";
import StaticRow from "../../StaticRow";
import Button from "../../Button";
import Modal from "../../Modal";
import Input from "../../Input";
import ErrorDescription from "../../ErrorDescription";
import { Amount } from "../../ActionDescription";

import { useStakingView } from "./../context/StakingViewContext";
import StakingManagerAction from "../StakingManagerAction";
import StakingGainsAction from "../StakingGainsAction";

import classes from "./StakingEditor.module.css";

const select = ({ lqtyBalance, totalStakedLQTY, lusdBalance }) => ({
  lqtyBalance,
  totalStakedLQTY,
  lusdBalance
});

const StakingEditor = ({ view, children, originalStake, editedLQTY, dispatch, dispatchView }) => {
  const { lqtyBalance, totalStakedLQTY } = useLiquitySelector(select);
  const { changePending } = useStakingView();
  const [stake, setStake] = useState(null);
  const [increment, setIncrement] = useState(null);
  const [decrement, setDecrement] = useState(null);

  const totalStakedLQTYAfterChange = totalStakedLQTY.sub(originalStake.stakedLQTY).add(editedLQTY);

  const originalPoolShare = originalStake.stakedLQTY.mulDiv(100, totalStakedLQTY);
  const newPoolShare = editedLQTY.mulDiv(100, totalStakedLQTYAfterChange);

  const redemptionGain = originalStake.isEmpty ? Decimal.ZERO : originalStake.collateralGain;
  const issuanceGain = originalStake.isEmpty ? Decimal.ZERO : originalStake.lusdGain;
  const staked = originalStake.isEmpty ? Decimal.ZERO : originalStake.stakedLQTY;

  const change = originalStake.whatChanged(editedLQTY);

  const [validChange, error] = !change
    ? [undefined, undefined]
    : change.stakeLQTY?.gt(lqtyBalance)
    ? [
        undefined,
        <ErrorDescription>
          The amount you're trying to stake exceeds your balance by{" "}
          <Amount>
            {change.stakeLQTY.sub(lqtyBalance).prettify()} {GT}
          </Amount>
          .
        </ErrorDescription>
      ]
    : [change, undefined];

  return (
    <div className={classes.wrapper}>
      {stake !== null && (
        <Modal
          title="STAKE LQTY"
          onClose={() => {
            setStake(null);
            dispatchView({ type: "cancelAdjusting" });
            dispatch({ type: "revert" });
          }}
        >
          <div className={classes.modalContent}>
            <Input
              label="stake"
              unit={GT}
              icon={process.env.PUBLIC_URL + "/icons/128-lusd-icon.svg"}
              value={stake}
              onChange={v => {
                setStake(v);
                dispatch({ type: "setStake", newValue: v });
              }}
              placeholder={Decimal.from(stake || 0).prettify(2)}
              available={`Available: ${lqtyBalance.prettify(2)}`}
              maxAmount={lqtyBalance.toString()}
              maxedOut={editedLQTY.eq(lqtyBalance)}
            />

            {error}

            <div className={classes.modalActions}>
              {validChange ? (
                <StakingManagerAction change={validChange} whenDone={() => setStake(null)} />
              ) : (
                <Button large primary disabled>
                  Confirm
                </Button>
              )}
            </div>

            <StaticRow label="Staked" amount={editedLQTY.prettify(2)} unit={GT} />
          </div>
        </Modal>
      )}

      {increment !== null && (
        <Modal
          title="STAKE LQTY"
          onClose={() => {
            setIncrement(null);
            dispatchView({ type: "cancelAdjusting" });
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
              available={`Available: ${lqtyBalance.prettify(2)}`}
              maxAmount={lqtyBalance.toString()}
              maxedOut={Decimal.from(increment || 0).eq(lqtyBalance)}
            />

            {error}

            <div className={classes.modalActions}>
              {validChange ? (
                <StakingManagerAction change={validChange} whenDone={() => setIncrement(null)} />
              ) : (
                <Button large primary disabled>
                  Confirm
                </Button>
              )}
            </div>

            <StaticRow label="Staked" amount={editedLQTY.prettify(2)} unit={GT} />
          </div>
        </Modal>
      )}

      {decrement !== null && (
        <Modal
          title="UNSTAKE LQTY"
          onClose={() => {
            setDecrement(null);
            dispatchView({ type: "cancelAdjusting" });
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
              available={`Available: ${staked.prettify(2)}`}
              maxAmount={staked.toString()}
              maxedOut={Decimal.from(decrement || 0).eq(staked)}
            />

            {error}

            {Decimal.from(decrement || 0).gt(originalStake.stakedLQTY) && (
              <ErrorDescription>
                The amount you're trying to unstake exceeds your stake by{" "}
                <Amount>
                  {Decimal.from(decrement).sub(originalStake.stakedLQTY).prettify()} {GT}
                </Amount>
                .
              </ErrorDescription>
            )}

            <div className={classes.modalActions}>
              {validChange && !Decimal.from(decrement || 0).gt(originalStake.stakedLQTY) ? (
                <StakingManagerAction change={validChange} whenDone={() => setDecrement(null)} />
              ) : (
                <Button large primary disabled>
                  Confirm
                </Button>
              )}
            </div>

            <StaticRow label="Staked" amount={editedLQTY.prettify(2)} unit={GT} />
          </div>
        </Modal>
      )}

      <div className={classes.staticInfo}>
        {newPoolShare.infinite ? (
          <StaticRow label="Pool share" amount="N/A" />
        ) : (
          <StaticRow label="Pool share" amount={originalPoolShare.prettify(4)} unit="%" />
        )}

        <StaticRow label="Redemption gain" amount={redemptionGain.prettify(4)} unit="ETH" />

        <StaticRow label="Issuance gain" amount={issuanceGain.prettify(2)} unit={COIN} />
      </div>

      <div className={classes.stakedWrapper}>
        {view !== "NONE" ? (
          <>
            <p className={classes.editLabel}>Staked</p>
            <p className={classes.editAmount}>
              {editedLQTY.prettify(2)} {GT}
            </p>
            <div className={classes.editActions}>
              <button
                onClick={() => {
                  dispatchView({ type: "startAdjusting" });
                  setDecrement("");
                }}
                disabled={editedLQTY.isZero}
                className={cn({ [classes.disabled]: editedLQTY.isZero })}
              >
                &#8722;
              </button>
              <button
                onClick={() => {
                  dispatchView({ type: "startAdjusting" });
                  setIncrement("");
                }}
                disabled={lqtyBalance.isZero}
                className={cn({ [classes.disabled]: lqtyBalance.isZero })}
              >
                &#43;
              </button>
            </div>
          </>
        ) : (
          <StaticRow labelColor="primary" label="Staked" amount={staked.prettify(2)} unit={GT} />
        )}
      </div>

      {error}

      <div className={classes.actions}>
        {view !== "NONE" ? (
          <StakingGainsAction />
        ) : (
          <Button
            primary
            large
            uppercase
            onClick={() => {
              dispatchView({ type: "startAdjusting" });
              setStake("");
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

export default StakingEditor;
