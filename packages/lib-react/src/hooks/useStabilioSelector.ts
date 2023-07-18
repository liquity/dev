import { useEffect, useReducer } from "react";

import { StabilioStoreState } from "@stabilio/lib-base";

import { equals } from "../utils/equals";
import { useStabilioStore } from "./useStabilioStore";

export const useStabilioSelector = <S, T>(select: (state: StabilioStoreState<T>) => S): S => {
  const store = useStabilioStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  useEffect(
    () =>
      store.subscribe(({ newState, oldState }) => {
        if (!equals(select(newState), select(oldState))) {
          rerender();
        }
      }),
    [store, select]
  );

  return select(store.state);
};
