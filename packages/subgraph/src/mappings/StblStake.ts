import { StakeChanged, StakingGainsWithdrawn } from "../../generated/STBLStaking/STBLStaking";

import { updateStake, withdrawStakeGains } from "../entities/StblStake";

export function handleStakeChanged(event: StakeChanged): void {
  updateStake(event, event.params.staker, event.params.newStake);
}

export function handleStakeGainsWithdrawn(event: StakingGainsWithdrawn): void {
  withdrawStakeGains(event, event.params.staker, event.params.LUSDGain, event.params.ETHGain);
}
