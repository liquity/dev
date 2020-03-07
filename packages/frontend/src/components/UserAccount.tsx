import React from "react";
import { Text } from "rimble-ui";

import { Decimal } from "@liquity/lib/dist/utils";

type UserAccountProps = {
  balance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ balance }) => {
  return <Text textAlign="center">You have {balance.prettify()} ETH available to deposit.</Text>;
};
