import { useCallback, useEffect, useReducer, useRef } from "react";

import { StabilioStoreState } from "@stabilio/lib-base";

import { equals } from "../utils/equals";
import { useStabilioStore } from "./useStabilioStore";

export type StabilioStoreUpdate<T = unknown> = {
  type: "updateStore";
  newState: StabilioStoreState<T>;
  oldState: StabilioStoreState<T>;
  stateChange: Partial<StabilioStoreState<T>>;
};

export const useStabilioReducer = <S, A, T>(
  reduce: (state: S, action: A | StabilioStoreUpdate<T>) => S,
  init: (storeState: StabilioStoreState<T>) => S
): [S, (action: A | StabilioStoreUpdate<T>) => void] => {
  const store = useStabilioStore<T>();
  const oldStore = useRef(store);
  const state = useRef(init(store.state));
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | StabilioStoreUpdate<T>) => {
      const newState = reduce(state.current, action);

      if (!equals(newState, state.current)) {
        state.current = newState;
        rerender();
      }
    },
    [reduce]
  );

  useEffect(() => store.subscribe(params => dispatch({ type: "updateStore", ...params })), [
    store,
    dispatch
  ]);

  if (oldStore.current !== store) {
    state.current = init(store.state);
    oldStore.current = store;
  }

  return [state.current, dispatch];
};
