import { Address } from "@graphprotocol/graph-ts";

import { Owner, Trove } from "../../generated/schema";

function getOwner(_user: Address): Owner {
  let id = _user.toHexString();
  let ownerOrNull = Owner.load(id);

  if (ownerOrNull != null) {
    return ownerOrNull as Owner;
  } else {
    let newOwner = new Owner(id);

    newOwner.troveCount = 0;
    return newOwner;
  }
}

export function getCurrentTroveOfOwner(_user: Address): Trove {
  let owner = getOwner(_user);
  let currentTrove: Trove;

  if (owner.currentTrove == null) {
    let troveSubId = owner.troveCount++;

    currentTrove = new Trove(_user.toHexString() + "-" + troveSubId.toString());
    currentTrove.owner = owner.id;
    owner.currentTrove = currentTrove.id;
    owner.save();
  } else {
    currentTrove = Trove.load(owner.currentTrove) as Trove;
  }

  return currentTrove;
}

export function closeCurrentTroveOfOwner(_user: Address): void {
  let owner = getOwner(_user);

  owner.currentTrove = null;
  owner.save();
}
