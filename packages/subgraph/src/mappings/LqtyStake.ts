import { StakeChanged, StakingGainsWithdrawn } from "../../generated/LQTYStaking/LQTYStaking";

import { updateStake, withdrawStakeGains } from "../entities/LqtyStake";

export function handleStakeChanged(event: StakeChanged): void {
  updateStake(event, event.params.staker, event.params.newStake);
}

export function handleStakeGainsWithdrawn(event: StakingGainsWithdrawn): void {
  withdrawStakeGains(event, event.params.staker, event.params.LUSDGain, event.params.ETHGain);
}
