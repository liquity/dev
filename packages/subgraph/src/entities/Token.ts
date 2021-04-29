import { Address } from "@graphprotocol/graph-ts";

import { Token } from "../../generated/schema";
import { ERC20 } from "../../generated/LUSDToken/ERC20";
import { BIGINT_ZERO } from "../utils/bignumbers";

function createToken(address: Address, name: string, symbol: string): Token {
  let id = address.toHexString();
  let token = new Token(id);
  token.name = name;
  token.symbol = symbol;
  token.totalSupply = BIGINT_ZERO;
  token.save();

  return token;
}

export function getToken(_token: Address): Token {
  let id = _token.toHexString();
  let tokenOrNull = Token.load(id);

  if (tokenOrNull != null) {
    return tokenOrNull as Token;
  } else {
    // Bind the contract to the address that emitted the event
    let contract = ERC20.bind(_token);

    // Access state variables and functions by calling them
    let name = contract.name();
    let symbol = contract.symbol();
    return createToken(_token, name, symbol);
  }
}
