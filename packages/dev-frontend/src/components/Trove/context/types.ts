type NoneView = "NONE";
type ClosedView = "CLOSED";
type AdjustingView = "ADJUSTING";
type ActiveView = "ACTIVE";

export type TroveView = NoneView | ClosedView | AdjustingView | ActiveView;

type OpenTroveEvent = "OPEN_TROVE";
type AdjustTroveEvent = "ADJUST_TROVE";
type TroveAdjustedEvent = "TROVE_ADJUSTED";
type TroveClosedEvent = "TROVE_CLOSED";
type AdjustTroveCancelledEvent = "ADJUST_TROVE_CANCELLED";
type CollateralClaimedEvent = "COLLATERAL_CLAIMED";
type TroveReceivedEvent = "TROVE_RECEIVED";

export type TroveEvent =
  | OpenTroveEvent
  | AdjustTroveEvent
  | TroveClosedEvent
  | TroveAdjustedEvent
  | AdjustTroveCancelledEvent
  | CollateralClaimedEvent
  | TroveReceivedEvent;
