import React from "react";
import { Text } from "rimble-ui";
import { Web3Provider } from "ethers/providers";

import { useAccountBalance } from "../hooks/AccountBalance";

type AccountBalanceProps = {
  provider: Web3Provider;
  account: string;
};

export const AccountBalance: React.FC<AccountBalanceProps> = ({ provider, account }) => {
  const accountBalanceState = useAccountBalance(provider, account);

  if (!accountBalanceState.loaded) {
    return null;
  }

  const accountBalance = accountBalanceState.value.toString(2);

  return <Text>You have {accountBalance} ETH available to deposit.</Text>;
};
