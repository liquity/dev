import { CollBalanceUpdated } from "../../generated/CollSurplusPool/CollSurplusPool";

import { updateUserClaimColl } from "../entities/User";

export function handleCollSurplusBalanceUpdated(event: CollBalanceUpdated): void {
  updateUserClaimColl(event, event.params._account, event.params._newBalance);
}
