import { Address } from "@graphprotocol/graph-ts";

import { User, Trove, StabilityDeposit } from "../../generated/schema";

import { DECIMAL_ZERO } from "../utils/bignumbers";

export function getUser(_user: Address): User {
  let id = _user.toHexString();
  let userOrNull = User.load(id);

  if (userOrNull != null) {
    return userOrNull as User;
  } else {
    let newUser = new User(id);

    newUser.troveCount = 0;
    newUser.stabilityDepositCount = 0;
    newUser.save();

    return newUser;
  }
}

export function getCurrentTroveOfOwner(_user: Address): Trove {
  let owner = getUser(_user);
  let currentTrove: Trove;

  if (owner.currentTrove == null) {
    let troveSubId = owner.troveCount++;

    currentTrove = new Trove(_user.toHexString() + "-" + troveSubId.toString());
    currentTrove.owner = owner.id;
    currentTrove.collateral = DECIMAL_ZERO;
    currentTrove.debt = DECIMAL_ZERO;
    owner.currentTrove = currentTrove.id;
    owner.save();
  } else {
    currentTrove = Trove.load(owner.currentTrove) as Trove;
  }

  return currentTrove;
}

export function closeCurrentTroveOfOwner(_user: Address): void {
  let owner = getUser(_user);

  owner.currentTrove = null;
  owner.save();
}

export function getCurrentStabilityDepositOfOwner(_user: Address): StabilityDeposit {
  let owner = getUser(_user);
  let currentStabilityDeposit: StabilityDeposit;

  if (owner.currentStabilityDeposit == null) {
    let stabilityDepositSubId = owner.stabilityDepositCount++;

    currentStabilityDeposit = new StabilityDeposit(
      _user.toHexString() + "-" + stabilityDepositSubId.toString()
    );
    currentStabilityDeposit.owner = owner.id;
    currentStabilityDeposit.depositedAmount = DECIMAL_ZERO;
    owner.currentStabilityDeposit = currentStabilityDeposit.id;
    owner.save();
  } else {
    currentStabilityDeposit = StabilityDeposit.load(
      owner.currentStabilityDeposit
    ) as StabilityDeposit;
  }

  return currentStabilityDeposit;
}

export function closeCurrentStabilityDepositOfOwner(_user: Address): void {
  let owner = getUser(_user);

  owner.currentStabilityDeposit = null;
  owner.save();
}
