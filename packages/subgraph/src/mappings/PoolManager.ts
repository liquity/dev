import {
  UserDepositChanged,
  ETHGainWithdrawn
} from "../../generated/templates/PoolManager/PoolManager";

import {
  updateStabilityDeposit,
  withdrawCollateralGainFromStabilityDeposit
} from "../entities/StabilityDeposit";

export function handleUserDepositChanged(event: UserDepositChanged): void {
  updateStabilityDeposit(event, event.params._user, event.params._amount);
}

export function handleETHGainWithdrawn(event: ETHGainWithdrawn): void {
  withdrawCollateralGainFromStabilityDeposit(
    event,
    event.params._user,
    event.params._ETH,
    event.params._CLVLoss
  );
}
