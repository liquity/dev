import { useCallback, useEffect, useReducer, useRef } from "react";

import { LiquityStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useLiquityStore } from "./useLiquityStore";

export type LiquityStoreUpdate<T = unknown> = {
  type: "updateStore";
  stateChange: Partial<LiquityStoreState<T>>;
};

export const useLiquityReducer = <S, A, T>(
  reduce: (state: S, action: A | LiquityStoreUpdate<T>) => S,
  init: (storeState: LiquityStoreState<T>) => S
): [S, (action: A | LiquityStoreUpdate<T>) => void] => {
  const store = useLiquityStore<T>();
  const state = useRef<S>();
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | LiquityStoreUpdate<T>) => {
      if (state.current) {
        const newState = reduce(state.current, action);
        if (!equals(newState, state.current)) {
          state.current = newState;
          rerender();
        }
      }
    },
    [reduce]
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(({ stateChange }) =>
      dispatch({ type: "updateStore", stateChange })
    );

    return () => {
      unsubscribe();
      state.current = undefined;
    };
  }, [store, dispatch]);

  if (state.current === undefined) {
    state.current = init(store.state);
  }

  return [state.current, dispatch];
};
