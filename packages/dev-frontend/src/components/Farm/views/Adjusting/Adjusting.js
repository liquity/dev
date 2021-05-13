import { useEffect, useState } from "react";
import cn from "classnames";

import { Decimal } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";

import { LP, GT } from "../../../../strings";
import { LoadingOverlay } from "../../../LoadingOverlay";
import { useFarmView } from "../../context/FarmViewContext";
import { useMyTransactionState } from "../../../Transaction";
import { Confirm } from "../Confirm.js";
import { Validation } from "../Validation";
import StaticRow from "../../../StaticRow";
import Modal from "../../../Modal";
import Input from "../../../Input";
import ErrorDescription from "../../../ErrorDescription";
import { Amount } from "../../../Amount";
import { UnstakeAndClaim } from "../UnstakeAndClaim";
import { ClaimReward } from "../Active/ClaimReward";

import classes from "./Adjusting.module.css";

const selector = ({
  liquidityMiningStake,
  liquidityMiningLQTYReward,
  uniTokenBalance,
  totalStakedUniTokens
}) => ({
  liquidityMiningStake,
  liquidityMiningLQTYReward,
  uniTokenBalance,
  totalStakedUniTokens
});

const transactionId = /farm-/;

export const Adjusting = () => {
  const { dispatchEvent } = useFarmView();
  const {
    liquidityMiningStake,
    liquidityMiningLQTYReward,
    uniTokenBalance,
    totalStakedUniTokens
  } = useLiquitySelector(selector);
  const transactionState = useMyTransactionState(transactionId);

  const [increment, setIncrement] = useState(null);
  const [decrement, setDecrement] = useState(null);

  useEffect(() => {
    if (transactionState.type === "confirmedOneShot") {
      setIncrement(null);
      setDecrement(null);
    }
  }, [transactionState]);

  const isTransactionPending =
    transactionState.type === "waitingForApproval" ||
    transactionState.type === "waitingForConfirmation";

  const isDirty = !liquidityMiningStake.eq(liquidityMiningStake);

  const nextTotalStakedUniTokens = isDirty
    ? totalStakedUniTokens.sub(liquidityMiningStake).add(liquidityMiningStake)
    : totalStakedUniTokens;

  const poolShare = liquidityMiningStake.mulDiv(100, nextTotalStakedUniTokens);

  const hasStakeAndRewards = !liquidityMiningStake.isZero && !liquidityMiningLQTYReward.isZero;

  const cannotDecrement = Decimal.from(decrement || 0).gt(liquidityMiningStake);

  return (
    <>
      <div className={classes.infos}>
        {poolShare.infinite ? (
          <StaticRow label="Pool share" inputId="farm-share" amount="N/A" />
        ) : (
          <StaticRow label="Pool share" amount={poolShare.prettify(4)} unit="%" />
        )}

        <StaticRow label="Reward" amount={liquidityMiningLQTYReward.prettify(2)} unit={GT} />
      </div>

      {increment !== null && (
        <Modal
          title="STAKE UNI LP"
          onClose={() => {
            setIncrement(null);
            dispatchEvent("CANCEL_PRESSED");
          }}
        >
          <div className={classes.modalContent}>
            <Input
              label="stake"
              unit={LP}
              icon={process.env.PUBLIC_URL + "/icons/uniswap-uni-logo.png"}
              value={increment}
              onChange={v => {
                setIncrement(v);
              }}
              placeholder={Decimal.from(increment || 0).prettify(2)}
              available={`Available: ${uniTokenBalance.prettify(2)}`}
              maxAmount={uniTokenBalance.toString()}
              maxedOut={Decimal.from(increment || 0).eq(uniTokenBalance)}
            />

            <Validation amount={liquidityMiningStake.add(Decimal.from(increment || 0))} />

            <div className={classes.actions}>
              <Confirm amount={liquidityMiningStake.add(Decimal.from(increment || 0))} />
            </div>

            <StaticRow
              label="Staked"
              amount={liquidityMiningStake.add(Decimal.from(increment || 0)).prettify(2)}
              unit={LP}
            />
          </div>
        </Modal>
      )}

      {decrement !== null && (
        <Modal
          title="UNSTAKE UNI LP"
          onClose={() => {
            setDecrement(null);
            dispatchEvent("CANCEL_PRESSED");
          }}
        >
          <div className={classes.modalContent}>
            <Input
              label="unstake"
              unit={LP}
              icon={process.env.PUBLIC_URL + "/icons/uniswap-uni-logo.png"}
              value={decrement}
              onChange={v => {
                setDecrement(v);
              }}
              placeholder={Decimal.from(decrement || 0).prettify(2)}
              available={`Available: ${liquidityMiningStake.prettify(2)}`}
              maxAmount={liquidityMiningStake.toString()}
              maxedOut={liquidityMiningStake.eq(Decimal.from(decrement || 0))}
            />

            {cannotDecrement && (
              <ErrorDescription>
                The amount you're trying to unstake exceeds your stake by{" "}
                <Amount>
                  {Decimal.from(decrement).sub(liquidityMiningStake).prettify()} {LP}
                </Amount>
                .
              </ErrorDescription>
            )}

            {isDirty && (
              <Validation
                amount={
                  cannotDecrement
                    ? liquidityMiningStake.sub(Decimal.from(increment || 0))
                    : Decimal.ZERO
                }
              />
            )}

            <div className={classes.actions}>
              <Confirm
                disabled={cannotDecrement}
                amount={
                  cannotDecrement
                    ? Decimal.ZERO
                    : liquidityMiningStake.sub(Decimal.from(decrement || 0))
                }
              />
            </div>

            <StaticRow
              label="Staked"
              amount={
                cannotDecrement
                  ? Decimal.ZERO.prettify(2)
                  : liquidityMiningStake.sub(Decimal.from(decrement || 0)).prettify(2)
              }
              unit={LP}
            />
          </div>
        </Modal>
      )}

      <div className={classes.stakedWrapper}>
        <p className={classes.editLabel}>Staked</p>
        <p className={classes.editAmount}>
          {liquidityMiningStake.prettify(2)} {LP}
        </p>
        <div className={classes.editActions}>
          <button
            onClick={() => {
              setDecrement("");
              dispatchEvent("ADJUST_PRESSED");
            }}
            disabled={liquidityMiningStake.isZero}
            className={cn({ [classes.disabled]: liquidityMiningStake.isZero })}
          >
            &#8722;
          </button>
          <button
            onClick={() => {
              dispatchEvent("ADJUST_PRESSED");
              setIncrement("");
            }}
            disabled={uniTokenBalance.isZero}
            className={cn({ [classes.disabled]: uniTokenBalance.isZero })}
          >
            &#43;
          </button>
        </div>
      </div>

      <div className={classes.actions}>
        <ClaimReward liquidityMiningLQTYReward={liquidityMiningLQTYReward} />

        <UnstakeAndClaim hasStakeAndRewards={hasStakeAndRewards} />
      </div>

      {isTransactionPending && <LoadingOverlay />}
    </>
  );
};
