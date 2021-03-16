type NoneView = "NONE";
type DepositingView = "DEPOSITING";
type ActiveView = "ACTIVE";
type AdjustingView = "ADJUSTING";

export type StabilityView = NoneView | DepositingView | ActiveView | AdjustingView;

type DepositPressedEvent = "DEPOSIT_PRESSED";
type AdjustDepositPressedEvent = "ADJUST_DEPOSIT_PRESSED";
type CancelPressedEvent = "CANCEL_PRESSED";
type DepositConfirmedEvent = "DEPOSIT_CONFIRMED";
type RewardsClaimedEvent = "REWARDS_CLAIMED";
type DepositEmptiedEvemt = "DEPOSIT_EMPTIED";

export type StabilityEvent =
  | DepositPressedEvent
  | AdjustDepositPressedEvent
  | CancelPressedEvent
  | DepositConfirmedEvent
  | RewardsClaimedEvent
  | DepositEmptiedEvemt;
