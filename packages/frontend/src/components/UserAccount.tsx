import React from "react";
import { Text } from "rimble-ui";

import { Decimal } from "@liquity/lib/dist/utils";

type UserAccountProps = {
  balance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ balance }) => {
  return <Text>You have {balance.toString(2)} ETH available to deposit.</Text>;
};
