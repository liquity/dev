import React, { useState, useCallback, useEffect, useRef } from "react";
import { LiquityStoreState, Decimal } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { FarmViewContext } from "./FarmViewContext";
import { transitions } from "./transitions";
import type { FarmView, FarmEvent } from "./transitions";

const transition = (view: FarmView, event: FarmEvent): FarmView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (
  liquidityMiningStake: Decimal,
  remainingLiquidityMiningLQTYReward: Decimal
): FarmView => {
  if (remainingLiquidityMiningLQTYReward.isZero) return "DISABLED";
  if (liquidityMiningStake.isZero) return "INACTIVE";
  return "ACTIVE";
};

const selector = ({
  liquidityMiningStake,
  remainingLiquidityMiningLQTYReward
}: LiquityStoreState) => ({ liquidityMiningStake, remainingLiquidityMiningLQTYReward });

export const FarmViewProvider: React.FC = props => {
  const { children } = props;
  const { liquidityMiningStake, remainingLiquidityMiningLQTYReward } = useLiquitySelector(selector);

  const [view, setView] = useState<FarmView>(
    getInitialView(liquidityMiningStake, remainingLiquidityMiningLQTYReward)
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
    if (liquidityMiningStake.isZero) {
      dispatchEvent("UNSTAKE_AND_CLAIM_CONFIRMED");
    }
  }, [liquidityMiningStake.isZero, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <FarmViewContext.Provider value={provider}>{children}</FarmViewContext.Provider>;
};
