import React from "react";
import { Text } from "rimble-ui";

import { Decimal } from "@liquity/lib/dist/utils";

type UserAccountProps = {
  etherBalance: Decimal;
  quiBalance: Decimal;
};

export const UserAccount: React.FC<UserAccountProps> = ({ etherBalance, quiBalance }) => {
  return (
    <>
      <Text textAlign="center">You have {etherBalance.prettify()} ETH.</Text>
      <Text textAlign="center">You have {quiBalance.prettify()} QUI.</Text>
    </>
  );
};
