import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { FarmViewContext } from "./FarmViewContext";
import { transitions } from "./transitions";

const transition = (view, event) => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (
  liquidityMiningStake,
  remainingLiquidityMiningLQTYReward,
  liquidityMiningLQTYReward
) => {
  if (remainingLiquidityMiningLQTYReward.isZero) return "DISABLED";
  if (liquidityMiningStake.isZero && liquidityMiningLQTYReward.isZero) return "INACTIVE";
  return "ACTIVE";
};

const selector = ({
  liquidityMiningStake,
  remainingLiquidityMiningLQTYReward,
  liquidityMiningLQTYReward
}) => ({
  liquidityMiningStake,
  remainingLiquidityMiningLQTYReward,
  liquidityMiningLQTYReward
});

export const FarmViewProvider = props => {
  const { children } = props;
  const {
    liquidityMiningStake,
    remainingLiquidityMiningLQTYReward,
    liquidityMiningLQTYReward
  } = useLiquitySelector(selector);

  const [view, setView] = useState(
    getInitialView(
      liquidityMiningStake,
      remainingLiquidityMiningLQTYReward,
      liquidityMiningLQTYReward
    )
  );
  const viewRef = useRef(view);

  const dispatchEvent = useCallback(event => {
    const nextView = transition(viewRef.current, event);

    console.log(
      "dispatchEvent() [current-view, event, next-view]",
      viewRef.current,
      event,
      nextView
    );
    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (liquidityMiningStake.isZero && liquidityMiningLQTYReward.isZero) {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    } else if (liquidityMiningStake.isZero && !liquidityMiningLQTYReward.isZero) {
      dispatchEvent("UNSTAKE_CONFIRMED");
    }
  }, [liquidityMiningStake.isZero, liquidityMiningLQTYReward.isZero, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <FarmViewContext.Provider value={provider}>{children}</FarmViewContext.Provider>;
};
