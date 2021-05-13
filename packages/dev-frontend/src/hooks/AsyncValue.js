import { useState, useEffect } from "react";

export function useAsyncValue(getValue, watchValue, reduceValues) {
  const [callState, setCallState] = useState({ loaded: false });

  useEffect(() => {
    let previousValue = undefined;
    let mounted = true;
    let unwatch;

    const fetchValue = async () => {
      const value = await getValue();

      if (mounted && previousValue === undefined) {
        setCallState({ loaded: true, value });
        previousValue = value;
      }
    };

    const onValueChanged = value => {
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

const allLoaded = store => {
  for (const { loaded } of Object.values(store)) {
    if (!loaded) {
      return false;
    }
  }
  return true;
};

export const useAsyncStore = store => {
  if (!allLoaded(store)) {
    return { loaded: false };
  }

  return {
    loaded: true,
    value: Object.fromEntries(
      Object.entries(store).map(([property, asyncValueState]) => [property, asyncValueState.value])
    )
  };
};
