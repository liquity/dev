import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

import { decimalize, DECIMAL_ZERO } from "../utils/bignumbers";

import { beginChange, initChange, finishChange } from "./Change";
import { updateSystemStateByCollSurplusChange } from "./SystemState";
import { User, CollSurplusChange } from "../../generated/schema";

export function getUser(_user: Address): User {
  let id = _user.toHexString();
  let userOrNull = User.load(id);

  if (userOrNull != null) {
    return userOrNull as User;
  } else {
    let newUser = new User(id);

    newUser.collSurplus = DECIMAL_ZERO;
    newUser.save();

    return newUser;
  }
}

function createCollSurplusChange(event: ethereum.Event): CollSurplusChange {
  let sequenceNumber = beginChange();
  let collSurplusChange = new CollSurplusChange(sequenceNumber.toString());
  initChange(collSurplusChange, event, sequenceNumber);

  return collSurplusChange;
}

function finishCollSurplusChange(stabilityDepositChange: CollSurplusChange): void {
  finishChange(stabilityDepositChange);
  stabilityDepositChange.save();
}

export function updateUserClaimColl(
  event: ethereum.Event,
  _borrower: Address,
  _collSurplus: BigInt
): void {
  let user = getUser(_borrower);
  let newCollSurplus = decimalize(_collSurplus);
  if (newCollSurplus == user.collSurplus) {
    return;
  }

  let collSurplusChange = createCollSurplusChange(event);

  collSurplusChange.user = user.id;

  collSurplusChange.collSurplusBefore = user.collSurplus;
  collSurplusChange.collSurplusAfter = newCollSurplus;
  collSurplusChange.collSurplusChange = collSurplusChange.collSurplusAfter.minus(
    collSurplusChange.collSurplusBefore
  );

  updateSystemStateByCollSurplusChange(collSurplusChange);
  finishCollSurplusChange(collSurplusChange);

  user.collSurplus = newCollSurplus;
  user.save();
}
