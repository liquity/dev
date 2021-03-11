import { useCallback, useEffect, useReducer, useRef } from "react";

import { LiquityStoreListenerParams, LiquityStoreState } from "@liquity/lib-base";

import { equals } from "../utils/equals";
import { useLiquityStore } from "./useLiquityStore";

export interface LiquityStoreUpdate<T = unknown> extends LiquityStoreListenerParams<T> {
  type: "updateStore";
}

export type LiquityReducer<S, A, T = unknown> = (state: S, action: A | LiquityStoreUpdate<T>) => S;
export type LiquityReducerInitializer<S, T = unknown> = (storeState: LiquityStoreState<T>) => S;
export type LiquityReducerDispatch<A, T = unknown> = (action: A | LiquityStoreUpdate<T>) => void;

export const useLiquityReducer = <S, A, T = unknown>(
  reduce: LiquityReducer<S, A, T>,
  init: LiquityReducerInitializer<S, T>
): [state: S, dispatch: LiquityReducerDispatch<A, T>] => {
  const store = useLiquityStore<T>();
  const oldStore = useRef(store);
  const state = useRef(init(store.state));
  const [, rerender] = useReducer(() => ({}), {});

  const dispatch = useCallback(
    (action: A | LiquityStoreUpdate<T>) => {
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
