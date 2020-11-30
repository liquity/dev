import {
  UserDepositChanged,
  ETHGainWithdrawn
} from "../../generated/templates/StabilityPool/StabilityPool";

import {
  updateStabilityDeposit,
  withdrawCollateralGainFromStabilityDeposit
} from "../entities/StabilityDeposit";

export function handleUserDepositChanged(event: UserDepositChanged): void {
  updateStabilityDeposit(event, event.params._depositor, event.params._newDeposit);
}

export function handleETHGainWithdrawn(event: ETHGainWithdrawn): void {
  withdrawCollateralGainFromStabilityDeposit(
    event,
    event.params._depositor,
    event.params._ETH,
    event.params._LUSDLoss
  );
}
