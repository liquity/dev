import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { LiquityStoreState } from "@liquity/lib-base";
import { TroveViewContext } from "./TroveViewContext";
import type { TroveView, TroveEvent } from "./types";

/*
TODO: remove this comment
Structure of dumb state machine:
{
  VIEW_1: {
    EVENT_1: NEXT_VIEW_1,
    EVENT_N: NEXT_VIEW_N,
  }, {
    VIEW_N: {
      EVENT_1: NEXT_VIEW_1,
      EVENT_N: NEXT_VIEW_N,
    }
  }
} */
type TroveTransitions = Record<TroveView, Partial<Record<TroveEvent, TroveView>>>;

const transition = (trove: TroveState, view: TroveView, event: TroveEvent): TroveView => {
  const transitions: TroveTransitions = {
    NONE: {
      OPEN_TROVE: "ADJUSTING",
      TROVE_RECEIVED: "ACTIVE"
    },
    CLOSED: {
      COLLATERAL_CLAIMED: "NONE",
      TROVE_RECEIVED: "ACTIVE"
    },
    ADJUSTING: {
      ADJUST_TROVE_CANCELLED: trove.isActive ? "ACTIVE" : "NONE",
      TROVE_ADJUSTED: "ACTIVE",
      TROVE_CLOSED: "CLOSED"
    },
    ACTIVE: {
      ADJUST_TROVE: "ADJUSTING",
      TROVE_CLOSED: "CLOSED"
    }
  };
  const nextView = transitions[view][event] || view;
  return nextView;
};

type TroveState = {
  isClosed: boolean;
  isActive: boolean;
};
const select = ({ trove, collateralSurplusBalance }: LiquityStoreState): TroveState => ({
  isClosed: !collateralSurplusBalance.isZero, // only works for Recovery mode - wait for dani's PR then merge
  // isClosed: !trove.status === "closed" closedByRedemption etc., // TODO: wait for dani's PR to merge
  isActive: !trove.isEmpty
});

const getInitialView = (trove: TroveState): TroveView => {
  if (trove.isClosed) {
    return "CLOSED";
  }
  if (trove.isActive) {
    return "ACTIVE";
  }
  return "NONE";
};

export const TroveViewProvider: React.FC = props => {
  const { children } = props;
  const trove = useLiquitySelector(select);

  const [view, setView] = useState<TroveView>(getInitialView(trove));

  const recordEvent = useCallback(
    (event: TroveEvent) => {
      const nextView = transition(trove, view, event);

      // TODO: remove this (and other) console logs
      console.log("recordEvent() (current-view, event, next-view)", view, event, nextView);

      setView(nextView);
    },
    [trove.isClosed, trove.isActive, view]
  );

  let previousTrove = useRef<TroveState>(trove);

  useEffect(() => {
    // this area is where you trigger trove events in response to backend changes
    // e.g. a trove was closed by someone else
    if (previousTrove.current.isActive && trove.isClosed) {
      recordEvent("TROVE_CLOSED");
    }
    // e.g. user has two tabs open with liquity and opens a trove in the other tab
    if (previousTrove.current.isClosed && trove.isActive) {
      recordEvent("TROVE_RECEIVED");
    }

    // need to look at collateral surplus and workout if user claimed their surplus in another tab
  }, [trove.isActive, trove.isClosed]);

  useEffect(() => {
    previousTrove.current = trove;
  }, [trove.isClosed, trove.isActive]);

  const provider = {
    view,
    recordEvent
  };
  return <TroveViewContext.Provider value={provider}>{children}</TroveViewContext.Provider>;
};
