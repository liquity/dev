type NoneView = "NONE";
type ClosedView = "CLOSED";
type AdjustingView = "ADJUSTING";
type ActiveView = "ACTIVE";

export type TroveView = NoneView | ClosedView | AdjustingView | ActiveView;

type OpenTrovePressedEvent = "OPEN_TROVE_PRESSED";
type AdjustTrovePressedEvent = "ADJUST_TROVE_PRESSED";
type CancelAdjustTrovePressed = "CANCEL_ADJUST_TROVE_PRESSED";
type TroveAdjustedEvent = "TROVE_ADJUSTED";
type TroveOpenedEvent = "TROVE_OPENED";
type TroveClosedEvent = "TROVE_CLOSED";
type TroveSurplusCollateralClaimedEvent = "TROVE_SURPLUS_COLLATERAL_CLAIMED";

export type TroveEvent =
  | OpenTrovePressedEvent
  | AdjustTrovePressedEvent
  | CancelAdjustTrovePressed
  | TroveClosedEvent
  | TroveAdjustedEvent
  | TroveSurplusCollateralClaimedEvent
  | TroveOpenedEvent;

export type TroveState = {
  isClosed: boolean;
  isActive: boolean;
};
