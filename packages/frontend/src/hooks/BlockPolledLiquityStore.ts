import { useCallback } from "react";
import { BigNumber } from "@ethersproject/bignumber";
import { Provider, BlockTag } from "@ethersproject/abstract-provider";

import { Liquity } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { useAsyncValue } from "./AsyncValue";

type Resolved<T> = T extends Promise<infer U> ? U : T;
type ResolvedValues<T> = { [P in keyof T]: Resolved<T[P]> };

const promiseAllValues = <T>(object: T): Promise<ResolvedValues<T>> => {
  const keys = Object.keys(object);
  return Promise.all(Object.values(object)).then(values =>
    Object.fromEntries(values.map((value, i) => [keys[i], value]))
  ) as Promise<ResolvedValues<T>>;
};

const decimalify = (bigNumber: BigNumber) => new Decimal(bigNumber);

export const useLiquityStore = (provider: Provider, account: string, liquity: Liquity) => {
  const get = useCallback(
    (blockTag?: BlockTag) =>
      promiseAllValues({
        etherBalance: provider.getBalance(account, blockTag).then(decimalify),
        quiBalance: liquity.getQuiBalance(account, { blockTag }),
        price: liquity.getPrice({ blockTag }),
        numberOfTroves: liquity.getNumberOfTroves({ blockTag }),
        trove: liquity.getTrove(account, { blockTag }),
        deposit: liquity.getStabilityDeposit(account, { blockTag }),
        total: liquity.getTotal({ blockTag }),
        quiInStabilityPool: liquity.getQuiInStabilityPool({ blockTag })
      }),
    [provider, account, liquity]
  );

  const watch = useCallback(
    (updateValues: (values: Resolved<ReturnType<typeof get>>) => void) => {
      const blockListener = async (blockNumber: number) => {
        await get(blockNumber).then(updateValues);
        console.log(`Updated store state to block #${blockNumber}`);
      };

      provider.on("block", blockListener);

      return () => provider.removeListener("block", blockListener);
    },
    [provider, get]
  );

  return useAsyncValue(get, watch);
};
