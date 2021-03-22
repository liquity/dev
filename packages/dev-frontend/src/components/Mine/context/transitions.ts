type InactiveView = "INACTIVE";
type StakingView = "STAKING";
type ActiveView = "ACTIVE";
type AdjustingView = "ADJUSTING";

export type MineView = InactiveView | StakingView | ActiveView | AdjustingView;

type StakePressedEvent = "STAKE_PRESSED";
type AdjustPressedEvent = "ADJUST_PRESSED";
type CancelPressedEvent = "CANCEL_PRESSED";
type StakeApprovedEvent = "STAKE_APPROVED";
type StakeConfirmedEvent = "STAKE_CONFIRMED";
type AdjustConfirmedEvent = "ADJUST_CONFIRMED";
type ClaimRewardConfirmedEvent = "CLAIM_REWARD_CONFIRMED";
type UnstakeAndClaimConfirmedEvent = "UNSTAKE_AND_CLAIM_CONFIRMED";

export type MineEvent =
  | StakePressedEvent
  | AdjustPressedEvent
  | CancelPressedEvent
  | StakeApprovedEvent
  | StakeConfirmedEvent
  | AdjustConfirmedEvent
  | ClaimRewardConfirmedEvent
  | UnstakeAndClaimConfirmedEvent;

type MineEventTransitions = Record<MineView, Partial<Record<MineEvent, MineView>>>;

export const transitions: MineEventTransitions = {
  INACTIVE: {
    STAKE_PRESSED: "STAKING"
  },
  STAKING: {
    CANCEL_PRESSED: "INACTIVE",
    STAKE_CONFIRMED: "ACTIVE",
    STAKE_APPROVED: "STAKING"
  },
  ACTIVE: {
    ADJUST_PRESSED: "ADJUSTING",
    CLAIM_REWARD_CONFIRMED: "ACTIVE",
    UNSTAKE_AND_CLAIM_CONFIRMED: "INACTIVE"
  },
  ADJUSTING: {
    CANCEL_PRESSED: "ACTIVE",
    ADJUST_CONFIRMED: "ACTIVE",
    STAKE_APPROVED: "ACTIVE"
  }
};
