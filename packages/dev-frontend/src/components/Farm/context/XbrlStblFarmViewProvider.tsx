import React, { useState, useCallback, useEffect, useRef } from "react";
import { StabilioStoreState, Decimal } from "@stabilio/lib-base";
import { useStabilioSelector } from "@stabilio/lib-react";
import { XbrlStblFarmViewContext } from "./XbrlStblFarmViewContext";
import { transitions } from "./transitions";
import type { FarmView, FarmEvent } from "./transitions";

const transition = (view: FarmView, event: FarmEvent): FarmView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (
  xbrlStblLiquidityMiningStake: Decimal,
  remainingXbrlStblLiquidityMiningSTBLReward: Decimal,
  xbrlStblLiquidityMiningSTBLReward: Decimal
): FarmView => {
  if (remainingXbrlStblLiquidityMiningSTBLReward.isZero) return "DISABLED";
  if (xbrlStblLiquidityMiningStake.isZero && xbrlStblLiquidityMiningSTBLReward.isZero) return "INACTIVE";
  return "ACTIVE";
};

const selector = ({
  xbrlStblLiquidityMiningStake,
  remainingXbrlStblLiquidityMiningSTBLReward,
  xbrlStblLiquidityMiningSTBLReward
}: StabilioStoreState) => ({
  xbrlStblLiquidityMiningStake,
  remainingXbrlStblLiquidityMiningSTBLReward,
  xbrlStblLiquidityMiningSTBLReward
});

export const XbrlStblFarmViewProvider: React.FC = props => {
  const { children } = props;
  const {
    xbrlStblLiquidityMiningStake,
    remainingXbrlStblLiquidityMiningSTBLReward,
    xbrlStblLiquidityMiningSTBLReward
  } = useStabilioSelector(selector);

  const [view, setView] = useState<FarmView>(
    getInitialView(
      xbrlStblLiquidityMiningStake,
      remainingXbrlStblLiquidityMiningSTBLReward,
      xbrlStblLiquidityMiningSTBLReward
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
    if (xbrlStblLiquidityMiningStake.isZero && xbrlStblLiquidityMiningSTBLReward.isZero) {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    } else if (xbrlStblLiquidityMiningStake.isZero && !xbrlStblLiquidityMiningSTBLReward.isZero) {
      dispatchEvent("UNSTAKE_CONFIRMED");
    }
  }, [xbrlStblLiquidityMiningStake.isZero, xbrlStblLiquidityMiningSTBLReward.isZero, dispatchEvent]);

  const xbrlStblView = view;

  const provider = {
    xbrlStblView,
    dispatchEvent
  };

  return <XbrlStblFarmViewContext.Provider value={provider}>{children}</XbrlStblFarmViewContext.Provider>;
};
