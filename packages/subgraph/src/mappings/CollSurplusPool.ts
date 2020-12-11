import {
  CollBalanceUpdated
} from "../../generated/templates/CollSurplusPool/CollSurplusPool";

import { updateTroveClaimColl } from "../entities/Trove";

export function handleCollSurplusBalanceUpdated(event: CollBalanceUpdated): void {
  updateTroveClaimColl(event, "claimCollSurplus", event.params._account, event.params._newBalance);
}
