import { useCallback } from "react";
import { Web3Provider } from "ethers/providers";
import { BigNumber } from "ethers/utils";

import { Decimal } from "@liquity/lib/dist/utils/Decimal";
import { useAsyncValue } from "./AsyncValue";

export const useAccountBalance = (provider: Web3Provider, account: string) => {
  const getAccountBalance = useCallback(
    async () => new Decimal(await provider.getBalance(account)),
    [provider, account]
  );

  const watchAccountBalance = useCallback(
    (onAccountBalanceChanged: (value: Decimal) => void) => {
      const balanceChangedListener = (balance: BigNumber) => {
        const etherBalance = new Decimal(balance);
        console.log(`Update etherBalance to ${etherBalance}`);
        onAccountBalanceChanged(etherBalance);
      };

      provider.on(account, balanceChangedListener);

      return () => provider.removeListener(account, balanceChangedListener);
    },
    [provider, account]
  );

  return useAsyncValue(getAccountBalance, watchAccountBalance);
};
