import { useState, useEffect } from "react";

export type AsyncValueState<T> = { loaded: false } | { loaded: true; value: T };

export function useAsyncValue<T>(
  getValue: () => Promise<T>,
  watchValue?: (onValueChanged: (value: T) => void) => () => void,
  reduceValues?: (previousValue: T, newValue: T) => T
) {
  const [callState, setCallState] = useState<AsyncValueState<T>>({ loaded: false });

  useEffect(() => {
    let previousValue: T | undefined = undefined;
    let mounted = true;
    let unwatch: (() => void) | undefined;

    const fetchValue = async () => {
      const value = await getValue();

      if (mounted && previousValue === undefined) {
        setCallState({ loaded: true, value });
        previousValue = value;
      }
    };

    const onValueChanged = (value: T) => {
      if (mounted) {
        if (previousValue !== undefined && reduceValues) {
          value = reduceValues(previousValue, value);
        }

        setCallState({ loaded: true, value });
        previousValue = value;
      }
    };

    setCallState({ loaded: false });
    fetchValue();

    if (watchValue) {
      unwatch = watchValue(onValueChanged);
    }

    return () => {
      mounted = false;
      if (unwatch) {
        unwatch();
      }
    };
  }, [getValue, watchValue, reduceValues]);

  return callState;
}

export type AsyncStore = {
  [property: string]: AsyncValueState<unknown>;
};

export type Values<T> = {
  [P in keyof T]: T[P] extends AsyncValueState<infer V> ? V : never;
};

type LoadedStore = {
  [property: string]: { loaded: true; value: unknown };
};

const allLoaded = (store: AsyncStore): store is LoadedStore => {
  for (const { loaded } of Object.values(store)) {
    if (!loaded) {
      return false;
    }
  }
  return true;
};

export const useAsyncStore = <T extends AsyncStore>(store: T): AsyncValueState<Values<T>> => {
  if (!allLoaded(store)) {
    return { loaded: false };
  }

  return {
    loaded: true,
    value: Object.fromEntries(
      Object.entries(store).map(([property, asyncValueState]) => [property, asyncValueState.value])
    ) as Values<T>
  };
};
