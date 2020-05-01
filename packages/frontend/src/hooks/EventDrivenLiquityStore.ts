import { useCallback } from "react";
import { BigNumber } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";

import { Liquity, Trove, StabilityDeposit } from "@liquity/lib";
import { Decimal } from "@liquity/lib/dist/utils";
import { useAsyncValue, useAsyncStore } from "./AsyncValue";
import { useAccountBalance } from "./AccountBalance";

export const useLiquityStore = (provider: Provider, account: string, liquity: Liquity) => {
  const getTotal = useCallback(() => liquity.getTotal(), [liquity]);
  const watchTotal = useCallback(
    (onTotalChanged: (total: Trove) => void) => {
      const logged = (total: Trove) => {
        console.log(`Update total to\n${total}`);
        onTotalChanged(total);
      };
      return liquity.watchTotal(logged);
    },
    [liquity]
  );

  const getNumberOfTroves = useCallback(() => liquity.getNumberOfTroves(), [liquity]);
  const watchNumberOfTroves = useCallback(
    (onNumberOfTrovesChanged: (numberOfTroves: BigNumber) => void) => {
      const logged = (numberOfTroves: BigNumber) => {
        console.log(`Update numberOfTroves to ${numberOfTroves}`);
        onNumberOfTrovesChanged(numberOfTroves);
      };
      return liquity.watchNumberOfTroves(logged);
    },
    [liquity]
  );

  const getPrice = useCallback(() => liquity.getPrice(), [liquity]);
  const watchPrice = useCallback(
    (onPriceChanged: (price: Decimal) => void) => {
      const logged = (price: Decimal) => {
        console.log(`Update price to ${price}`);
        onPriceChanged(price);
      };
      return liquity.watchPrice(logged);
    },
    [liquity]
  );

  const getTrove = useCallback(() => liquity.getTrove(), [liquity]);
  const watchTrove = useCallback(
    (onTroveChanged: (trove: Trove) => void) => {
      const logged = (trove: Trove) => {
        console.log(`Update trove to\n${trove}`);
        onTroveChanged(trove);
      };
      return liquity.watchTrove(logged);
    },
    [liquity]
  );

  const getStabilityDeposit = useCallback(() => liquity.getStabilityDeposit(), [liquity]);
  const watchStabilityDeposit = useCallback(
    (onStabilityDepositChanged: (deposit: StabilityDeposit) => void) => {
      const logged = (deposit: StabilityDeposit) => {
        console.log(`Update deposit to\n${deposit}`);
        onStabilityDepositChanged(deposit);
      };
      return liquity.watchStabilityDeposit(logged);
    },
    [liquity]
  );

  const getQuiBalance = useCallback(() => liquity.getQuiBalance(), [liquity]);
  const watchQuiBalance = useCallback(
    (onQuiBalanceChanged: (balance: Decimal) => void) => {
      const logged = (balance: Decimal) => {
        console.log(`Update quiBalance to ${balance}`);
        onQuiBalanceChanged(balance);
      };
      return liquity.watchQuiBalance(logged);
    },
    [liquity]
  );

  const getQuiInStabilityPool = useCallback(() => liquity.getQuiInStabilityPool(), [liquity]);
  const watchQuiInStabilityPool = useCallback(
    (onQuiInStabilityPoolChanged: (quiInStabilityPool: Decimal) => void) => {
      const logged = (quiInStabilityPool: Decimal) => {
        console.log(`Update quiInStabilityPool to ${quiInStabilityPool}`);
        onQuiInStabilityPoolChanged(quiInStabilityPool);
      };
      return liquity.watchQuiInStabilityPool(logged);
    },
    [liquity]
  );

  return useAsyncStore({
    etherBalance: useAccountBalance(provider, account),
    quiBalance: useAsyncValue(getQuiBalance, watchQuiBalance),
    price: useAsyncValue(getPrice, watchPrice),
    numberOfTroves: useAsyncValue(getNumberOfTroves, watchNumberOfTroves),
    trove: useAsyncValue(getTrove, watchTrove),
    deposit: useAsyncValue(getStabilityDeposit, watchStabilityDeposit),
    total: useAsyncValue(getTotal, watchTotal),
    quiInStabilityPool: useAsyncValue(getQuiInStabilityPool, watchQuiInStabilityPool)
  });
};
