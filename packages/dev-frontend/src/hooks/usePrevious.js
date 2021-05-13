import { useRef } from "react";

export function usePrevious(value) {
  const ref = useRef(value);

  const previousValue = ref.current;
  ref.current = value;

  return previousValue;
}
