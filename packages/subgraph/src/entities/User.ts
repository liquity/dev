import { Address } from "@graphprotocol/graph-ts";

import { User } from "../../generated/schema";

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
