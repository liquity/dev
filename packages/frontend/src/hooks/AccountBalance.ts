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
        onAccountBalanceChanged(new Decimal(balance));
      };

      provider.on(account, balanceChangedListener);

      return () => provider.removeListener(account, balanceChangedListener);
    },
    [provider, account]
  );

  return useAsyncValue(getAccountBalance, watchAccountBalance);
};
