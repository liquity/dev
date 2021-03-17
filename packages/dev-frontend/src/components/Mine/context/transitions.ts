type NoneView = "NONE";
type Stake = "STAKE";
type ActiveView = "ACTIVE";
type AdjustView = "ADJUST";

export type MineView = NoneView | Stake | ActiveView | AdjustView;

type StakePressedEvent = "STAKE_PRESSED";
type AdjustPressedEvent = "ADJUST_PRESSED";
type CancelPressedEvent = "CANCEL_PRESSED";
type MineConfirmedEvent = "STAKE_CONFIRMED";
type ClaimRewardConfirmedEvent = "CLAIM_REWARD_CONFIRMED";
type UnstakeConfirmedEvent = "UNSTAKE_CONFIRMED";

export type MineEvent =
  | StakePressedEvent
  | AdjustPressedEvent
  | CancelPressedEvent
  | MineConfirmedEvent
  | ClaimRewardConfirmedEvent
  | UnstakeConfirmedEvent;

type MineEventTransitions = Record<MineView, Partial<Record<MineEvent, MineView>>>;

export const transitions: MineEventTransitions = {
  NONE: {
    STAKE_PRESSED: "STAKE"
  },
  STAKE: {
    CANCEL_PRESSED: "NONE",
    STAKE_CONFIRMED: "ACTIVE"
  },
  ACTIVE: {
    CLAIM_REWARD_CONFIRMED: "ACTIVE",
    ADJUST_PRESSED: "ADJUST",
    UNSTAKE_CONFIRMED: "NONE"
  },
  ADJUST: {
    CANCEL_PRESSED: "ACTIVE",
    STAKE_CONFIRMED: "ACTIVE",
    UNSTAKE_CONFIRMED: "NONE"
  }
};
