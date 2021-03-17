import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { LiquityStoreState, StabilityDeposit } from "@liquity/lib-base";
import { StabilityViewContext } from "./StabilityViewContext";
import type { StabilityView, StabilityEvent } from "./types";

type StabilityEventTransitions = Record<
  StabilityView,
  Partial<Record<StabilityEvent, StabilityView>>
>;

const transitions: StabilityEventTransitions = {
  NONE: {
    DEPOSIT_PRESSED: "DEPOSITING"
  },
  DEPOSITING: {
    CANCEL_PRESSED: "NONE",
    DEPOSIT_CONFIRMED: "ACTIVE"
  },
  ACTIVE: {
    REWARDS_CLAIMED: "ACTIVE",
    ADJUST_DEPOSIT_PRESSED: "ADJUSTING",
    DEPOSIT_EMPTIED: "NONE"
  },
  ADJUSTING: {
    CANCEL_PRESSED: "ACTIVE",
    DEPOSIT_CONFIRMED: "ACTIVE",
    DEPOSIT_EMPTIED: "NONE"
  }
};

const transition = (view: StabilityView, event: StabilityEvent): StabilityView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const getInitialView = (stabilityDeposit: StabilityDeposit): StabilityView => {
  return stabilityDeposit.isEmpty ? "NONE" : "ACTIVE";
};

const select = ({ stabilityDeposit }: LiquityStoreState): StabilityDeposit => stabilityDeposit;

export const StabilityViewProvider: React.FC = props => {
  const { children } = props;
  const stabilityDeposit = useLiquitySelector(select);

  const [view, setView] = useState<StabilityView>(getInitialView(stabilityDeposit));
  const viewRef = useRef<StabilityView>(view);

  const dispatchEvent = useCallback((event: StabilityEvent) => {
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
    if (stabilityDeposit.isEmpty) {
      dispatchEvent("DEPOSIT_EMPTIED");
    }
  }, [stabilityDeposit.isEmpty, dispatchEvent]);

  const provider = {
    view,
    dispatchEvent
  };

  return <StabilityViewContext.Provider value={provider}>{children}</StabilityViewContext.Provider>;
};
