import { Transfer, Approval } from "../../generated/LUSDToken/ERC20";

import { updateBalance } from "../entities/TokenBalance";
import { updateAllowance } from "../entities/TokenAllowance";

export function handleTokenTransfer(event: Transfer): void {
  updateBalance(event, event.params.from, event.params.to, event.params.value);
}

export function handleTokenApproval(event: Approval): void {
  updateAllowance(event, event.params.owner, event.params.spender, event.params.value);
}
