import { BigInt } from "@graphprotocol/graph-ts";

import {
  UserDepositChanged,
  ETHGainWithdrawn,
  FrontEndRegistered,
  FrontEndTagSet
} from "../../generated/StabilityPool/StabilityPool";

import { BIGINT_ZERO } from "../utils/bignumbers";

import { getGlobal } from "../entities/Global";

import {
  updateStabilityDeposit,
  withdrawCollateralGainFromStabilityDeposit
} from "../entities/StabilityDeposit";
import { registerFrontend, assignFrontendToDepositor } from "../entities/Frontend";

// Read the value of tmpDepositUpdate from the Global entity, and replace it with:
//  - null, if it wasn't null
//  - valueToSetIfNull if it was null
//
// Returns the value of tmpDepositUpdate before the swap.
function swapTmpDepositUpdate(valueToSetIfNull: BigInt): BigInt | null {
  let global = getGlobal();

  let tmpDepositUpdate = global.tmpDepositUpdate;
  global.tmpDepositUpdate = tmpDepositUpdate == null ? valueToSetIfNull : null;
  global.save();

  return tmpDepositUpdate;
}

export function handleUserDepositChanged(event: UserDepositChanged): void {
  let ethGainWithdrawn = swapTmpDepositUpdate(event.params._newDeposit);

  if (ethGainWithdrawn != null) {
    updateStabilityDeposit(event, event.params._depositor, event.params._newDeposit);
  }
}

export function handleETHGainWithdrawn(event: ETHGainWithdrawn): void {
  // Leave a non-null dummy value to signal to handleUserDepositChanged()
  // that ETH gains have been withdrawn
  let depositUpdate = swapTmpDepositUpdate(BIGINT_ZERO);

  withdrawCollateralGainFromStabilityDeposit(
    event,
    event.params._depositor,
    event.params._ETH,
    event.params._LUSDLoss
  );

  if (depositUpdate != null) {
    updateStabilityDeposit(event, event.params._depositor, depositUpdate as BigInt);
  }
}

export function handleFrontendRegistered(event: FrontEndRegistered): void {
  registerFrontend(event.params._frontEnd, event.params._kickbackRate);
}

export function handleFrontendTagSet(event: FrontEndTagSet): void {
  assignFrontendToDepositor(event.params._depositor, event.params._frontEnd);
}
