import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

import { BIGINT_ZERO } from "../utils/bignumbers";

import { TokenAllowance } from "../../generated/schema";

import { getUser } from "./User";

export function getTokenAllowance(
  _token: Address,
  _owner: Address,
  _spender: Address
): TokenAllowance {
  let id = _token.toHexString() + "-" + _owner.toHexString() + "-" + _spender.toHexString();
  let owner = getUser(_owner);
  let spender = getUser(_spender);
  let allowanceOrNull = TokenAllowance.load(id);

  if (allowanceOrNull != null) {
    return allowanceOrNull as TokenAllowance;
  } else {
    let newAllowance = new TokenAllowance(id);

    newAllowance.token = _token.toHexString();
    newAllowance.owner = owner.id;
    newAllowance.spender = spender.id;
    newAllowance.value = BIGINT_ZERO;
    newAllowance.save();

    return newAllowance;
  }
}

export function updateAllowance(
  _event: ethereum.Event,
  _owner: Address,
  _spender: Address,
  _value: BigInt
): void {
  let tokenAddress = _event.address;

  let tokenAllowance = getTokenAllowance(tokenAddress, _owner, _spender);
  tokenAllowance.value = _value;
  tokenAllowance.save();
}
