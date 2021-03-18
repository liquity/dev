import React, { useState, useCallback, useEffect, useRef } from "react";
// import { useLiquitySelector } from "@liquity/lib-react";
// import { LiquityStoreState, UniswapStake } from "@liquity/lib-base";
import { MineViewContext } from "./MineViewContext";
import { transitions } from "./transitions";
import type { MineView, MineEvent } from "./transitions";

const transition = (view: MineView, event: MineEvent): MineView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

// const getInitialView = (uniswapStake: UniswapStake): StakeView => {
//   return uniswapStake.isEmpty ? "NONE" : "ACTIVE";
// };

// const select = ({ uniswapStake }: LiquityStoreState): UniswapStake => uniswapStake;

export const MineViewProvider: React.FC = props => {
  const { children } = props;
  // const uniswapStake = useLiquitySelector(select);

  const [view, setView] = useState<MineView>("ACTIVE");
  const viewRef = useRef<MineView>(view);

  const dispatchEvent = useCallback((event: MineEvent) => {
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

  // useEffect(() => {
  //   if (uniswapStake.isEmpty) {
  //     dispatchEvent("UNSTAKE_CONFIRMED");
  //   }
  // }, [uniswapStake.isEmpty, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <MineViewContext.Provider value={provider}>{children}</MineViewContext.Provider>;
};
