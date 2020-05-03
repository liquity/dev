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
      let fetchedBlock = 0;

      const blockListener = async (blockNumber: number) => {
        // There is currently an Infura issue related to load balancing
        // (https://github.com/MetaMask/metamask-extension/issues/7234)
        // where we get a block event with a certain block number, but when we try to run a request
        // on that block, the block (header) is not found. We have implemented a retry mechanism
        // for this in WebSocketAugmentedProvider. However, waiting just 10 ms here allows us to
        // avoid the majority of these glitches from occuring in the first place.
        await new Promise(resolve => setTimeout(resolve, 10));

        const values = await get(blockNumber);

        if (blockNumber > fetchedBlock) {
          updateValues(values);
          fetchedBlock = blockNumber;
          console.log(`Updated store state to block #${blockNumber}`);
        }
      };

      provider.on("block", blockListener);

      return () => provider.removeListener("block", blockListener);
    },
    [provider, get]
  );

  return useAsyncValue(get, watch);
};
