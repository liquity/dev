import { useState, useEffect } from "react";

export type AsyncValueState<T> = { type: "loading" } | { type: "loaded"; value: T };

export function useAsyncValue<T>(
  getValue: () => Promise<T>,
  watchValue?: (onValueChanged: (value: T) => void) => () => void
) {
  const [callState, setCallState] = useState<AsyncValueState<T>>({ type: "loading" });

  useEffect(() => {
    const fetchValue = async () => {
      setCallState({ type: "loaded", value: await getValue() });
    };

    const onValueChanged = (value: T) => {
      setCallState({ type: "loaded", value });
    };

    fetchValue();

    if (watchValue) {
      return watchValue(onValueChanged);
    }
  }, [getValue, watchValue]);

  return callState;
}
