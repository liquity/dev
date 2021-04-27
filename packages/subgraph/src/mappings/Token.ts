import { Transfer, Approval } from '../../generated/templates/LQTYToken/LQTYToken';

import { updateBalance, updateAllowance } from "../entities/TokenBalance";

export function handleTokenTransfer(event: Transfer): void {
  updateBalance(event, event.params.from, event.params.to, event.params.value);
}

export function handleTokenApproval(event: Approval): void {
  updateAllowance(event, event.params.owner, event.params.spender, event.params.value);
}
