import { ethereum, Address, BigDecimal } from "@graphprotocol/graph-ts";

import { Token, TokenChange } from "../../generated/schema";
import { ERC20 } from "../../generated/templates/Token/ERC20"
import { DECIMAL_ZERO } from "../utils/bignumbers";

import { beginChange, initChange, finishChange } from "./Change";

export function createToken(address: Address, name: string, symbol: string): Token {
  let id = address.toHexString();
  let token = new Token(id);
  token.name = name;
  token.symbol = symbol;
  token.totalSupply = DECIMAL_ZERO;
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

function startTokenChange(event: ethereum.Event): TokenChange {
  let sequenceNumber = beginChange(event);
  let tokenChange = new TokenChange(sequenceNumber.toString());
  initChange(tokenChange, event, sequenceNumber);
  return tokenChange;
}

function finishTokenChange(tokenChange: TokenChange): void {
  finishChange(tokenChange);
  tokenChange.save();
}

export function changeToken(_event: ethereum.Event, _token: Token, _newTotalSupply: BigDecimal, _operation: string): void {
  let tokenChange = startTokenChange(_event);
  tokenChange.token = _token.id;
  tokenChange.tokenOperation = _operation;
  tokenChange.totalSupplyBefore = _token.totalSupply;
  tokenChange.totalSupplyChange = _newTotalSupply.minus(_token.totalSupply);
  tokenChange.totalSupplyAfter = _newTotalSupply;

  _token.totalSupply = _newTotalSupply;
  _token.save();

  finishTokenChange(tokenChange);
}
