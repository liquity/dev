type NoneView = "NONE";
type DepositView = "DEPOSIT";
type ActiveView = "ACTIVE";
type AdjustView = "ADJUST";

export type MineView = NoneView | DepositView | ActiveView | AdjustView;

type DepositPressedEvent = "DEPOSIT_PRESSED";
type AdjustPressedEvent = "ADJUST_PRESSED";
type CancelPressedEvent = "CANCEL_PRESSED";
type MineConfirmedEvent = "DEPOSIT_CONFIRMED";
type ClaimRewardConfirmedEvent = "CLAIM_REWARD_CONFIRMED";
type UnmineConfirmedEvent = "WITHDRAW_CONFIRMED";

export type MineEvent =
  | DepositPressedEvent
  | AdjustPressedEvent
  | CancelPressedEvent
  | MineConfirmedEvent
  | ClaimRewardConfirmedEvent
  | UnmineConfirmedEvent;

type MineEventTransitions = Record<MineView, Partial<Record<MineEvent, MineView>>>;

export const transitions: MineEventTransitions = {
  NONE: {
    DEPOSIT_PRESSED: "DEPOSIT"
  },
  DEPOSIT: {
    CANCEL_PRESSED: "NONE",
    DEPOSIT_CONFIRMED: "ACTIVE"
  },
  ACTIVE: {
    CLAIM_REWARD_CONFIRMED: "ACTIVE",
    ADJUST_PRESSED: "ADJUST",
    WITHDRAW_CONFIRMED: "NONE"
  },
  ADJUST: {
    CANCEL_PRESSED: "ACTIVE",
    DEPOSIT_CONFIRMED: "ACTIVE",
    WITHDRAW_CONFIRMED: "NONE"
  }
};
