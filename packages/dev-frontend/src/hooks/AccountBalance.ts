import { useCallback } from "react";
import { Provider } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";

import { Decimal } from "@liquity/lib/dist/utils/Decimal";
import { useAsyncValue } from "./AsyncValue";

export const useAccountBalance = (provider: Provider, account: string) => {
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
