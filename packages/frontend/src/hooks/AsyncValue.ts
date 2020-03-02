import { useState, useEffect } from "react";

export type AsyncValueState<T> = { loaded: false } | { loaded: true; value: T };

export function useAsyncValue<T>(
  getValue: () => Promise<T>,
  watchValue?: (onValueChanged: (value: T) => void) => () => void
) {
  const [callState, setCallState] = useState<AsyncValueState<T>>({ loaded: false });

  useEffect(() => {
    const fetchValue = async () => {
      setCallState({ loaded: true, value: await getValue() });
    };

    const onValueChanged = (value: T) => {
      setCallState({ loaded: true, value });
    };

    fetchValue();

    if (watchValue) {
      return watchValue(onValueChanged);
    }
  }, [getValue, watchValue]);

  return callState;
}
