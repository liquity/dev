import React, { useState, useCallback, useEffect, useRef } from "react";
import { useLiquitySelector } from "@liquity/lib-react";
import { LiquityStoreState, UserTroveStatus } from "@liquity/lib-base";
import { TroveViewContext } from "./TroveViewContext";
import type { TroveView, TroveEvent } from "./types";

type TroveTransitions = Record<TroveView, Partial<Record<TroveEvent, TroveView>>>;

const transition = (view: TroveView, event: TroveEvent): TroveView => {
  const transitions: TroveTransitions = {
    NONE: {
      OPEN_TROVE_PRESSED: "OPENING",
      TROVE_OPENED: "ACTIVE"
    },
    LIQUIDATED: {
      TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
      TROVE_OPENED: "ACTIVE"
    },
    REDEEMED: {
      TROVE_SURPLUS_COLLATERAL_CLAIMED: "NONE",
      TROVE_OPENED: "ACTIVE"
    },
    OPENING: {
      CANCEL_ADJUST_TROVE_PRESSED: "NONE",
      TROVE_OPENED: "ACTIVE"
    },
    ADJUSTING: {
      CANCEL_ADJUST_TROVE_PRESSED: "ACTIVE",
      TROVE_ADJUSTED: "ACTIVE",
      TROVE_CLOSED: "NONE",
      TROVE_LIQUIDATED: "LIQUIDATED",
      TROVE_REDEEMED: "REDEEMED"
    },
    ACTIVE: {
      ADJUST_TROVE_PRESSED: "ADJUSTING",
      TROVE_CLOSED: "NONE",
      TROVE_LIQUIDATED: "LIQUIDATED",
      TROVE_REDEEMED: "REDEEMED"
    }
  };
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

const select = ({ trove: { status } }: LiquityStoreState) => status;

const getInitialView = (troveStatus: UserTroveStatus): TroveView => {
  if (troveStatus === "closedByLiquidation") {
    return "LIQUIDATED";
  }
  if (troveStatus === "closedByRedemption") {
    return "REDEEMED";
  }
  if (troveStatus === "open") {
    return "ACTIVE";
  }
  return "NONE";
};

export const TroveViewProvider: React.FC = props => {
  const { children } = props;
  const troveStatus = useLiquitySelector(select);

  const [view, setView] = useState<TroveView>(getInitialView(troveStatus));
  const viewRef = useRef<TroveView>(view);

  const recordEvent = useCallback((event: TroveEvent) => {
    const nextView = transition(viewRef.current, event);

    // TODO: remove this (and other) console logs
    console.log("recordEvent() [current-view, event, next-view]", viewRef.current, event, nextView);

    setView(nextView);
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    // this area is where you trigger trove events in response to backend changes
    // e.g. a trove was closed by someone else
    recordEvent(
      troveStatus === "open"
        ? "TROVE_OPENED"
        : troveStatus === "closedByOwner"
        ? "TROVE_CLOSED"
        : troveStatus === "closedByLiquidation"
        ? "TROVE_LIQUIDATED"
        : troveStatus === "closedByRedemption"
        ? "TROVE_REDEEMED"
        : "TROVE_CLOSED" // === "nonExistent"; shouldn't happen (TODO: panic?)
    );
  }, [troveStatus, recordEvent]);

  const provider = {
    view,
    recordEvent
  };
  return <TroveViewContext.Provider value={provider}>{children}</TroveViewContext.Provider>;
};
