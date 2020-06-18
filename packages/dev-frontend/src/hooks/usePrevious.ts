import { useRef } from "react";

export function usePrevious<T>(value: T) {
  const ref = useRef<T>(value);

  const previousValue = ref.current;
  ref.current = value;

  return previousValue;
}
