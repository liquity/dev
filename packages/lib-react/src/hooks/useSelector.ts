import { useEffect, useReducer } from "react";

import { LiquityStoreState } from "@liquity/lib-base";

import { useLiquityStore } from "./useLiquityStore";

type UnknownObject = Record<string, unknown>;

const hasOwnProperty = (o: UnknownObject, key: string) =>
  Object.prototype.hasOwnProperty.call(o, key);

const shallowEquals = (a: UnknownObject, b: UnknownObject) => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  return (
    keysA.length === keysB.length &&
    keysA.every(key => hasOwnProperty(b, key) && Object.is(a[key], b[key]))
  );
};

const isObject = (a: unknown): a is UnknownObject => a !== null && typeof a === "object";

const equals = (a: unknown, b: unknown) =>
  isObject(a) && isObject(b) ? shallowEquals(a, b) : Object.is(a, b);

export const useSelector = <P, T>(select: (state: LiquityStoreState<T>) => P): P => {
  const store = useLiquityStore<T>();
  const [, rerender] = useReducer(() => ({}), {});

  useEffect(
    () =>
      store.subscribe((newState, oldState) => {
        if (oldState === undefined || !equals(select(newState), select(oldState))) {
          rerender();
        }
      }),
    [store, select]
  );

  return select(store.state);
};
