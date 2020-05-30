import { useCallback } from "react";
import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Decimal } from "@liquity/decimal";
import { Liquity, Trove, StabilityDeposit } from "@liquity/lib";
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
    async (blockTag?: number) => {
      const store = await promiseAllValues({
        etherBalance: provider.getBalance(account, blockTag).then(decimalify),
        quiBalance: liquity.getQuiBalance(account, { blockTag }),
        price: liquity.getPrice({ blockTag }),
        numberOfTroves: liquity.getNumberOfTroves({ blockTag }),
        troveWithoutRewards: liquity.getTroveWithoutRewards(account, { blockTag }),
        totalRedistributed: liquity.getTotalRedistributed({ blockTag }),
        deposit: liquity.getStabilityDeposit(account, { blockTag }),
        total: liquity.getTotal({ blockTag }),
        quiInStabilityPool: liquity.getQuiInStabilityPool({ blockTag })
      });

      return {
        blockTag,
        ...store,
        trove: store.troveWithoutRewards.applyRewards(store.totalRedistributed)
      };
    },
    [provider, account, liquity]
  );

  type Values = Resolved<ReturnType<typeof get>> & {
    [prop: string]: number | Decimal | Trove | StabilityDeposit | undefined;
  };

  const watch = useCallback(
    (updateValues: (values: Values) => void) => {
      const blockListener = (blockNumber: number) => {
        get(blockNumber).then(updateValues);
      };

      provider.on("block", blockListener);
      return () => provider.off("block", blockListener);
    },
    [provider, get]
  );

  const reduce = useCallback(
    (previous: Values, neuu: Values) =>
      Object.fromEntries(
        Object.keys(previous).map(key => {
          const previousValue = previous[key];
          const newValue = neuu[key];

          const equals =
            previousValue === newValue ||
            (previousValue instanceof Decimal && previousValue.eq(newValue as Decimal)) ||
            (previousValue instanceof Trove && previousValue.equals(newValue as Trove)) ||
            (previousValue instanceof StabilityDeposit &&
              previousValue.equals(newValue as StabilityDeposit));

          if (!equals) {
            console.log(`Update ${key} to ${newValue}`);
          }

          return [key, equals ? previousValue : newValue];
        })
      ) as Values,
    []
  );

  return useAsyncValue(get, watch, reduce);
};
