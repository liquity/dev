import { createLiquityFSMReducer, useLiquityReducer } from "@liquity/lib-react";
import { LiquityStoreListenerParams, LiquityStoreState, UserTroveStatus } from "@liquity/lib-base";
import { TroveViewContext, TroveViewContextType } from "./TroveViewContext";
import type { TroveView, TroveEvent } from "./types";

type TroveEventTransitions = Record<TroveView, Partial<Record<TroveEvent, TroveView>>>;

const transitions: TroveEventTransitions = {
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

type TroveStateEvents = Partial<Record<UserTroveStatus, TroveEvent>>;

const troveStatusEvents: TroveStateEvents = {
  open: "TROVE_OPENED",
  closedByOwner: "TROVE_CLOSED",
  closedByLiquidation: "TROVE_LIQUIDATED",
  closedByRedemption: "TROVE_REDEEMED"
};

const mapTroveStatusUpdateToEvent = ({
  oldState,
  newState
}: LiquityStoreListenerParams): TroveEvent | undefined => {
  if (newState.trove.status !== oldState.trove.status) {
    return troveStatusEvents[newState.trove.status];
  }
};

const getInitialView = ({ trove: { status: troveStatus } }: LiquityStoreState): TroveView => {
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

const troveViewFSMReducer = createLiquityFSMReducer(transitions, mapTroveStatusUpdateToEvent);

export const TroveViewProvider: React.FC = props => {
  const { children } = props;
  const [view, dispatch] = useLiquityReducer(troveViewFSMReducer, getInitialView);

  const provider: TroveViewContextType = {
    view,
    dispatchEvent: event => dispatch({ type: "fireFSMEvent", event })
  };

  return <TroveViewContext.Provider value={provider}>{children}</TroveViewContext.Provider>;
};
