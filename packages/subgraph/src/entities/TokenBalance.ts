import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

import { DECIMAL_ZERO, decimalize } from "../utils/bignumbers";
import { ZERO_ADDRESS } from "../utils/constants";

import { TokenBalance } from "../../generated/schema";

import { getUser } from "./User";
import { getToken } from "./Token";

export function getTokenBalance(_token: Address, _owner: Address): TokenBalance {
  let id = _token.toHexString() + _owner.toHexString();
  let user = getUser(_owner);
  let balanceOrNull = TokenBalance.load(id);

  if (balanceOrNull != null) {
    return balanceOrNull as TokenBalance;
  } else {
    let newBalance = new TokenBalance(id);

    newBalance.token = _token.toHexString();
    newBalance.owner = user.id;
    newBalance.balance = DECIMAL_ZERO;
    newBalance.save();

    return newBalance;
  }
}

export function updateBalance(_event: ethereum.Event, _from: Address, _to: Address, _value: BigInt): void {
  let tokenAddress = _event.address;
  let token = getToken(tokenAddress);
  let decimalValue = decimalize(_value);

  if (_from.toHexString() == ZERO_ADDRESS) { // mint
    // increase total supply
    token.totalSupply = token.totalSupply.plus(decimalValue);
    token.save();
  } else {
    // decrease from balance
    let tokenBalanceFrom = getTokenBalance(tokenAddress, _from);
    tokenBalanceFrom.balance = tokenBalanceFrom.balance.minus(decimalValue);
    tokenBalanceFrom.save();
  }
  if (_to.toHexString() == ZERO_ADDRESS) { // burn
    // decrease total supply
    token.totalSupply = token.totalSupply.minus(decimalValue);
    token.save();
  } else {
    // increase to balance
    let tokenBalanceTo = getTokenBalance(tokenAddress, _to);
    tokenBalanceTo.balance = tokenBalanceTo.balance.plus(decimalValue);
    tokenBalanceTo.save();
  }
}
