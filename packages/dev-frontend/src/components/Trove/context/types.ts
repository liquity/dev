type NoneView = "NONE";
type LiquidatedView = "LIQUIDATED";
type RedeemedView = "REDEEMED";
type OpeningView = "OPENING";
type AdjustingView = "ADJUSTING";
type ClosingView = "CLOSING";
type ActiveView = "ACTIVE";

export type TroveView =
  | NoneView
  | LiquidatedView
  | RedeemedView
  | OpeningView
  | AdjustingView
  | ClosingView
  | ActiveView;

type OpenTrovePressedEvent = "OPEN_TROVE_PRESSED";
type AdjustTrovePressedEvent = "ADJUST_TROVE_PRESSED";
type CloseTrovePressedEvent = "CLOSE_TROVE_PRESSED";
type CancelAdjustTrovePressed = "CANCEL_ADJUST_TROVE_PRESSED";
type TroveAdjustedEvent = "TROVE_ADJUSTED";
type TroveOpenedEvent = "TROVE_OPENED";
type TroveClosedEvent = "TROVE_CLOSED";
type TroveLiquidatedEvent = "TROVE_LIQUIDATED";
type TroveRedeemedEvent = "TROVE_REDEEMED";
type TroveSurplusCollateralClaimedEvent = "TROVE_SURPLUS_COLLATERAL_CLAIMED";

export type TroveEvent =
  | OpenTrovePressedEvent
  | AdjustTrovePressedEvent
  | CloseTrovePressedEvent
  | CancelAdjustTrovePressed
  | TroveClosedEvent
  | TroveLiquidatedEvent
  | TroveRedeemedEvent
  | TroveAdjustedEvent
  | TroveSurplusCollateralClaimedEvent
  | TroveOpenedEvent;
