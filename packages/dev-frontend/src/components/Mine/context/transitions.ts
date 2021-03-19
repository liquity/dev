type NoneView = "NONE";
type Stake = "STAKE";
type ActiveView = "ACTIVE";
type AdjustView = "ADJUST";

export type MineView = NoneView | Stake | ActiveView | AdjustView;

type StakePressedEvent = "STAKE_PRESSED";
type AdjustPressedEvent = "ADJUST_PRESSED";
type CancelPressedEvent = "CANCEL_PRESSED";
type StakeConfirmedEvent = "STAKE_CONFIRMED";
type AdjustConfirmedEvent = "ADJUST_CONFIRMED";
type ClaimRewardConfirmedEvent = "CLAIM_REWARD_CONFIRMED";
type UnstakeAndClaimConfirmedEvent = "UNSTAKE_AND_CLAIM_CONFIRMED";

export type MineEvent =
  | StakePressedEvent
  | AdjustPressedEvent
  | CancelPressedEvent
  | StakeConfirmedEvent
  | AdjustConfirmedEvent
  | ClaimRewardConfirmedEvent
  | UnstakeAndClaimConfirmedEvent;

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
    ADJUST_PRESSED: "ADJUST",
    CLAIM_REWARD_CONFIRMED: "ACTIVE",
    UNSTAKE_AND_CLAIM_CONFIRMED: "NONE"
  },
  ADJUST: {
    CANCEL_PRESSED: "ACTIVE",
    ADJUST_CONFIRMED: "ACTIVE"
  }
};
