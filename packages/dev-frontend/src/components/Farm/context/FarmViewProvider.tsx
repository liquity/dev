import React, { useState, useCallback, useEffect, useRef } from "react";
import { StabilioStoreState, Decimal } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
import { FarmViewContext } from "./FarmViewContext";
import { transitions } from "./transitions";
import type { FarmView, FarmEvent } from "./transitions";

const transition = (view: FarmView, event: FarmEvent): FarmView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (
  xbrlWethLiquidityMiningStake: Decimal,
  remainingXbrlWethLiquidityMiningSTBLReward: Decimal,
  xbrlWethLiquidityMiningSTBLReward: Decimal
): FarmView => {
  if (remainingXbrlWethLiquidityMiningSTBLReward.isZero) return "DISABLED";
  if (xbrlWethLiquidityMiningStake.isZero && xbrlWethLiquidityMiningSTBLReward.isZero) return "INACTIVE";
  return "ACTIVE";
};

const selector = ({
  xbrlWethLiquidityMiningStake,
  remainingXbrlWethLiquidityMiningSTBLReward,
  xbrlWethLiquidityMiningSTBLReward
}: StabilioStoreState) => ({
  xbrlWethLiquidityMiningStake,
  remainingXbrlWethLiquidityMiningSTBLReward,
  xbrlWethLiquidityMiningSTBLReward
});

export const FarmViewProvider: React.FC = props => {
  const { children } = props;
  const {
    xbrlWethLiquidityMiningStake,
    remainingXbrlWethLiquidityMiningSTBLReward,
    xbrlWethLiquidityMiningSTBLReward
  } = useStabilioSelector(selector);

  const [view, setView] = useState<FarmView>(
    getInitialView(
      xbrlWethLiquidityMiningStake,
      remainingXbrlWethLiquidityMiningSTBLReward,
      xbrlWethLiquidityMiningSTBLReward
    )
  );
  const viewRef = useRef<FarmView>(view);

  const dispatchEvent = useCallback((event: FarmEvent) => {
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
    if (xbrlWethLiquidityMiningStake.isZero && xbrlWethLiquidityMiningSTBLReward.isZero) {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    } else if (xbrlWethLiquidityMiningStake.isZero && !xbrlWethLiquidityMiningSTBLReward.isZero) {
      dispatchEvent("UNSTAKE_CONFIRMED");
    }
  }, [xbrlWethLiquidityMiningStake.isZero, xbrlWethLiquidityMiningSTBLReward.isZero, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <FarmViewContext.Provider value={provider}>{children}</FarmViewContext.Provider>;
};
